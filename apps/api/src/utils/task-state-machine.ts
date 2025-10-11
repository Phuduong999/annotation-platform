import { Pool } from 'pg';

/**
 * Task State Machine Validator
 * Enforces strict state transitions and provides audit logging
 */

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export type TaskEventType =
  | 'task_created'
  | 'task_assigned'
  | 'task_started'
  | 'annotation_draft_saved'
  | 'task_completed'
  | 'task_skipped'
  | 'task_failed'
  | 'task_reassigned'
  | 'task_updated';

export interface TaskTransitionContext {
  taskId: string;
  userId?: string;
  annotation?: any;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Allowed state transitions
 */
const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  'pending': ['in_progress'],
  'in_progress': ['in_progress', 'completed', 'pending'], // pending via skip
  'completed': [], // Immutable
  'failed': [], // Immutable
  'skipped': [], // Immutable (treated as failed)
};

/**
 * State transition error
 */
export class StateTransitionError extends Error {
  constructor(
    message: string,
    public from: TaskStatus,
    public to: TaskStatus,
    public allowedTransitions: TaskStatus[]
  ) {
    super(message);
    this.name = 'StateTransitionError';
  }
}

/**
 * ETag mismatch error
 */
export class ETagMismatchError extends Error {
  constructor(
    message: string,
    public expected: string,
    public actual: string
  ) {
    super(message);
    this.name = 'ETagMismatchError';
  }
}

/**
 * Validate state transition
 */
export function validateStateTransition(from: TaskStatus, to: TaskStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

/**
 * Get allowed transitions for a status
 */
export function getAllowedTransitions(status: TaskStatus): TaskStatus[] {
  return ALLOWED_TRANSITIONS[status] || [];
}

/**
 * Check if state transition is valid, throw error if not
 */
export function ensureValidTransition(from: TaskStatus, to: TaskStatus): void {
  if (!validateStateTransition(from, to)) {
    const allowed = getAllowedTransitions(from);
    throw new StateTransitionError(
      `Invalid state transition from '${from}' to '${to}'. Allowed transitions: ${allowed.join(', ') || 'none'}`,
      from,
      to,
      allowed
    );
  }
}

/**
 * Validate ETag matches current updated_at
 */
export function validateETag(etag: string | undefined, currentUpdatedAt: Date): void {
  if (!etag) {
    return; // ETag is optional
  }

  const cleanEtag = etag.replace(/"/g, ''); // Remove quotes
  const currentEtag = currentUpdatedAt.toISOString();

  if (cleanEtag !== currentEtag) {
    throw new ETagMismatchError(
      'Task has been modified by another user',
      cleanEtag,
      currentEtag
    );
  }
}

/**
 * Generate ETag from updated_at
 */
export function generateETag(updatedAt: Date): string {
  return `"${updatedAt.toISOString()}"`;
}

/**
 * Log task event to audit trail
 */
export async function logTaskEvent(
  pool: Pool,
  eventType: TaskEventType,
  context: TaskTransitionContext,
  oldStatus?: TaskStatus,
  newStatus?: TaskStatus
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO task_events (
        task_id, event_type, user_id, old_status, new_status,
        annotation_data, metadata, ip_address, user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        context.taskId,
        eventType,
        context.userId || null,
        oldStatus || null,
        newStatus || null,
        context.annotation ? JSON.stringify(context.annotation) : null,
        context.metadata ? JSON.stringify(context.metadata) : null,
        context.ipAddress || null,
        context.userAgent || null,
      ]
    );
  } catch (error) {
    // Log error but don't fail the transaction
    console.error('Failed to log task event:', error);
  }
}

/**
 * Get task audit trail
 */
export async function getTaskAuditTrail(
  pool: Pool,
  taskId: string
): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM task_events
     WHERE task_id = $1
     ORDER BY created_at DESC`,
    [taskId]
  );
  return result.rows;
}

/**
 * Get user task activity
 */
export async function getUserTaskActivity(
  pool: Pool,
  userId: string,
  limit: number = 50
): Promise<any[]> {
  const result = await pool.query(
    `SELECT te.*, t.request_id, t.type as task_type
     FROM task_events te
     JOIN tasks t ON te.task_id = t.id
     WHERE te.user_id = $1
     ORDER BY te.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

/**
 * Check if task is immutable (completed, failed, or skipped)
 */
export function isTaskImmutable(status: TaskStatus): boolean {
  return ['completed', 'failed', 'skipped'].includes(status);
}

/**
 * Determine event type from status transition
 */
export function getEventTypeFromTransition(
  from: TaskStatus,
  to: TaskStatus,
  isDraft: boolean = false
): TaskEventType {
  if (from === 'pending' && to === 'in_progress') {
    return 'task_started';
  }
  if (from === 'in_progress' && to === 'in_progress' && isDraft) {
    return 'annotation_draft_saved';
  }
  if (from === 'in_progress' && to === 'completed') {
    return 'task_completed';
  }
  if (from === 'in_progress' && to === 'pending') {
    return 'task_skipped';
  }
  if (to === 'failed') {
    return 'task_failed';
  }
  return 'task_updated';
}

/**
 * Transaction-safe state transition with audit logging
 */
export async function executeStateTransition(
  pool: Pool,
  taskId: string,
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
  context: TaskTransitionContext
): Promise<void> {
  // Validate transition
  ensureValidTransition(fromStatus, toStatus);

  // Start transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update task status
    await client.query(
      `UPDATE tasks 
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      [toStatus, taskId]
    );

    // Log event (using the pooled client in transaction)
    await client.query(
      `INSERT INTO task_events (
        task_id, event_type, user_id, old_status, new_status,
        annotation_data, metadata, ip_address, user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        taskId,
        getEventTypeFromTransition(fromStatus, toStatus),
        context.userId || null,
        fromStatus,
        toStatus,
        context.annotation ? JSON.stringify(context.annotation) : null,
        context.metadata ? JSON.stringify(context.metadata) : null,
        context.ipAddress || null,
        context.userAgent || null,
      ]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Format state transition error for API response
 */
export function formatStateTransitionError(error: StateTransitionError) {
  return {
    success: false,
    error: error.message,
    error_code: 'INVALID_STATE_TRANSITION',
    details: {
      current_status: error.from,
      attempted_status: error.to,
      allowed_transitions: error.allowedTransitions,
    },
  };
}

/**
 * Format ETag mismatch error for API response
 */
export function formatETagMismatchError(error: ETagMismatchError) {
  return {
    success: false,
    error: error.message,
    error_code: 'TASK_MODIFIED',
    details: {
      expected_version: error.expected,
      current_version: error.actual,
    },
  };
}