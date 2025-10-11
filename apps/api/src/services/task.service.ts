import { Pool } from 'pg';
import { ScanTypeEnum } from '@monorepo/shared';
import {
  TaskStatus,
  TaskEventType,
  AnnotationRequest,
  TaskWithAnnotations,
  LabelsDraft,
  LabelsFinal,
} from '../types/annotation.types.js';

export interface TaskCreationResult {
  totalRows: number;
  tasksCreated: number;
  tasksSkipped: number;
  skipReasons: Record<string, number>;
}

export interface TaskAssignmentResult {
  totalTasks: number;
  assignments: Array<{
    userId: string;
    tasksAssigned: number;
  }>;
}

export interface Task {
  id: string;
  request_id: string;
  user_id: string;
  team_id: string;
  scan_type: string;
  user_input: string;
  raw_ai_output: any;
  ai_confidence?: number;
  status: string;
  assigned_to?: string;
  assigned_at?: Date;
}

export type AssignmentMethod = 'equal_split' | 'pull_queue';

/**
 * Task Service
 * 
 * STRATEGY: Option 1 - Unified task creation
 * - ImportService only creates import_rows (no tasks)
 * - TaskService handles ALL task creation via createTasksFromImportJob()
 * - Tasks are only created for valid rows with link_status='ok'
 * - Prevents duplicate tasks and ensures proper link validation
 * 
 * Key Features:
 * - Creates tasks only from valid import_rows with good assets (link_status='ok')
 * - Idempotent task creation (checks for existing tasks)
 * - Links tasks to import_rows via import_row_id
 * - Supports task assignment strategies (equal_split, pull_queue)
 */
export class TaskService {
  constructor(private pool: Pool) {}

  /**
   * Create tasks from valid import rows
   * 
   * STRATEGY: Option 1 implementation (with optional skip link check)
   * - Creates tasks for valid import_rows
   * - Can skip link check for testing (skipLinkCheck=true)
   * - Can assign to specific user (assignTo='user123')
   * - Prevents duplicate tasks (idempotent)
   * - Validates ScanTypeEnum values during task creation
   */
  async createTasksFromImportJob(
    jobId: string, 
    options?: { skipLinkCheck?: boolean; assignTo?: string }
  ): Promise<TaskCreationResult> {
    const result: TaskCreationResult = {
      totalRows: 0,
      tasksCreated: 0,
      tasksSkipped: 0,
      skipReasons: {},
    };

    // Get all valid import rows with asset status
    const validRowsResult = await this.pool.query(
      `SELECT ir.*, a.link_status, a.url
       FROM import_rows ir
       LEFT JOIN assets a ON a.request_id = ir.row_data->>'request_id'
       WHERE ir.import_job_id = $1 AND ir.status = 'valid'
       ORDER BY ir.line_number`,
      [jobId]
    );

    result.totalRows = validRowsResult.rows.length;

    for (const row of validRowsResult.rows) {
      const rowData = row.row_data;
      const requestId = rowData.request_id;

      try {
        // Skip if link status is not 'ok' (prevents broken image tasks)
        // Unless skipLinkCheck is true (for testing)
        if (!options?.skipLinkCheck && row.link_status !== 'ok') {
          result.tasksSkipped++;
          const reason = row.link_status || 'no_link_check';
          result.skipReasons[reason] = (result.skipReasons[reason] || 0) + 1;
          continue;
        }

        // Check if task already exists (idempotent)
        const existingTask = await this.pool.query(
          'SELECT id FROM tasks WHERE request_id = $1',
          [requestId]
        );

        if (existingTask.rows.length > 0) {
          result.tasksSkipped++;
          result.skipReasons['already_exists'] = (result.skipReasons['already_exists'] || 0) + 1;
          continue;
        }

        // Validate scan type (extra safety check)
        if (!ScanTypeEnum.safeParse(rowData.type).success) {
          result.tasksSkipped++;
          result.skipReasons['invalid_scan_type'] = (result.skipReasons['invalid_scan_type'] || 0) + 1;
          continue;
        }

        // Parse and validate raw_ai_output
        let parsedAiOutput;
        let aiConfidence: number | null = null;
        
        try {
          parsedAiOutput = JSON.parse(rowData.raw_ai_output);
          // Extract AI confidence if available
          if (parsedAiOutput.confidence !== undefined) {
            aiConfidence = parseFloat(parsedAiOutput.confidence);
          } else if (parsedAiOutput.score !== undefined) {
            aiConfidence = parseFloat(parsedAiOutput.score);
          }
        } catch (e) {
          result.tasksSkipped++;
          result.skipReasons['invalid_json'] = (result.skipReasons['invalid_json'] || 0) + 1;
          continue;
        }

        // Create task with proper field mapping (including extended fields)
        // Assign to specified user if provided, otherwise leave unassigned
        await this.pool.query(
          `INSERT INTO tasks 
           (import_row_id, request_id, user_id, team_id, scan_type, user_input, raw_ai_output, 
            ai_confidence, scan_date, status, assigned_to, user_email, user_full_name, user_log, 
            raw_user_log, is_logged, edit_category, ai_output_log)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11, $12, $13, $14, $15, $16, $17)`,
          [
            row.id,                                                      // $1: import_row_id
            requestId,                                                   // $2: request_id
            rowData.user_id,                                            // $3: user_id 
            rowData.team_id,                                            // $4: team_id
            rowData.type,                                               // $5: scan_type
            rowData.user_input,                                         // $6: user_input (image URL)
            parsedAiOutput,                                             // $7: raw_ai_output (parsed JSON)
            aiConfidence,                                               // $8: ai_confidence
            new Date(rowData.date),                                     // $9: scan_date
            options?.assignTo || null,                                  // $10: assigned_to (from options)
            rowData.user_email || null,                                 // $11: user_email
            rowData.user_full_name || null,                             // $12: user_full_name
            rowData.user_log || null,                                   // $13: user_log
            rowData.raw_user_log || null,                               // $14: raw_user_log
            rowData.is_logged === 'true' ? true : (rowData.is_logged === 'false' ? false : null),  // $15: is_logged
            rowData.edit_category || null,                              // $16: edit_category
            rowData.ai_output_log || null,                              // $17: ai_output_log
          ]
        );

        result.tasksCreated++;
      } catch (error) {
        // Handle individual row errors without failing the entire batch
        result.tasksSkipped++;
        result.skipReasons['creation_error'] = (result.skipReasons['creation_error'] || 0) + 1;
        console.error(`Error creating task for request_id ${requestId}:`, error);
      }
    }

    return result;
  }

  /**
   * Assign tasks using equal-split strategy
   */
  async assignTasksEqualSplit(
    userIds: string[],
    quotaPerUser?: number
  ): Promise<TaskAssignmentResult> {
    const result: TaskAssignmentResult = {
      totalTasks: 0,
      assignments: [],
    };

    // Get pending tasks
    const pendingTasks = await this.pool.query(
      `SELECT * FROM tasks 
       WHERE status = 'pending' AND assigned_to IS NULL
       ORDER BY created_at ASC`
    );

    const tasks = pendingTasks.rows;
    result.totalTasks = tasks.length;

    if (tasks.length === 0 || userIds.length === 0) {
      return result;
    }

    // Calculate quota per user
    const effectiveQuota = quotaPerUser || Math.ceil(tasks.length / userIds.length);

    // Distribute tasks
    let taskIndex = 0;
    for (const userId of userIds) {
      let assigned = 0;
      const maxToAssign = Math.min(effectiveQuota, tasks.length - taskIndex);

      while (assigned < maxToAssign && taskIndex < tasks.length) {
        const task = tasks[taskIndex];

        // Assign task
        await this.assignTask(task.id, userId, 'equal_split', null);

        assigned++;
        taskIndex++;
      }

      result.assignments.push({
        userId,
        tasksAssigned: assigned,
      });

      if (taskIndex >= tasks.length) {
        break;
      }
    }

    return result;
  }

  /**
   * Get next task for user (pull-based queue)
   */
  async getNextTask(userId: string): Promise<Task | null> {
    // Get highest priority unassigned task
    const taskResult = await this.pool.query(
      `SELECT * FROM tasks 
       WHERE status = 'pending' AND assigned_to IS NULL
       ORDER BY 
         COALESCE(ai_confidence, 0) DESC,
         created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`
    );

    if (taskResult.rows.length === 0) {
      return null;
    }

    const task = taskResult.rows[0];

    // Assign to user
    await this.assignTask(task.id, userId, 'pull_queue', task.ai_confidence);

    return task;
  }

  /**
   * Assign a task to a user and log the assignment
   */
  private async assignTask(
    taskId: string,
    userId: string,
    method: AssignmentMethod,
    priorityScore: number | null
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Update task
      await client.query(
        `UPDATE tasks 
         SET assigned_to = $1, assigned_at = NOW(), status = 'assigned'
         WHERE id = $2`,
        [userId, taskId]
      );

      // Log assignment
      await client.query(
        `INSERT INTO task_assignments 
         (task_id, assigned_to, assignment_method, priority_score)
         VALUES ($1, $2, $3, $4)`,
        [taskId, userId, method, priorityScore]
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
   * Get task statistics
   */
  async getTaskStats() {
    const stats = await this.pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'pending' AND assigned_to IS NULL) as unassigned,
         COUNT(*) FILTER (WHERE status = 'assigned') as assigned,
         COUNT(*) FILTER (WHERE status = 'completed') as completed,
         COUNT(*) FILTER (WHERE status = 'processing') as processing,
         COUNT(*) as total
       FROM tasks`
    );

    const assignmentStats = await this.pool.query(
      `SELECT 
         assigned_to,
         COUNT(*) as task_count,
         assignment_method
       FROM task_assignments
       GROUP BY assigned_to, assignment_method
       ORDER BY task_count DESC`
    );

    return {
      taskCounts: stats.rows[0],
      assignments: assignmentStats.rows,
    };
  }

  /**
   * Get tasks assigned to a user
   */
  async getUserTasks(userId: string) {
    const result = await this.pool.query(
      `SELECT t.*, ta.assignment_method, ta.assigned_at as assignment_logged_at
       FROM tasks t
       LEFT JOIN task_assignments ta ON ta.task_id = t.id
       WHERE t.assigned_to = $1
       ORDER BY t.assigned_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Get assignment logs
   */
  async getAssignmentLogs(filters?: { userId?: string; method?: string; limit?: number }) {
    let query = `
      SELECT ta.*, t.request_id, t.scan_type
      FROM task_assignments ta
      JOIN tasks t ON t.id = ta.task_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.userId) {
      query += ` AND ta.assigned_to = $${paramIndex}`;
      params.push(filters.userId);
      paramIndex++;
    }

    if (filters?.method) {
      query += ` AND ta.assignment_method = $${paramIndex}`;
      params.push(filters.method);
      paramIndex++;
    }

    query += ` ORDER BY ta.assigned_at DESC`;

    if (filters?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
    }

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Start working on a task
   */
  async startTask(taskId: string, userId: string): Promise<TaskWithAnnotations> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get task with current status
      const taskResult = await client.query(
        `SELECT t.*, ld.payload as draft_payload, lf.* as final_data
         FROM tasks t
         LEFT JOIN labels_draft ld ON ld.task_id = t.id
         LEFT JOIN labels_final lf ON lf.task_id = t.id
         WHERE t.id = $1
         FOR UPDATE`,
        [taskId]
      );

      if (taskResult.rows.length === 0) {
        throw new Error('Task not found');
      }

      const task = taskResult.rows[0];

      // Check if task can be started
      if (task.status === 'completed' || task.status === 'skipped') {
        throw new Error(`Task is already ${task.status}`);
      }

      // Check if already in progress by another user
      if (task.status === 'in_progress' && task.assigned_to !== userId) {
        throw new Error(`Task is already in progress by user ${task.assigned_to}`);
      }

      // If already in progress by same user, just return task
      if (task.status === 'in_progress' && task.assigned_to === userId) {
        await client.query('COMMIT');
        return this.buildTaskWithAnnotations(task);
      }

      // Update task status
      const updateResult = await client.query(
        `UPDATE tasks 
         SET status = 'in_progress', 
             assigned_to = $1, 
             assigned_at = CASE WHEN assigned_at IS NULL THEN NOW() ELSE assigned_at END,
             started_at = NOW(),
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [userId, taskId]
      );

      const updatedTask = updateResult.rows[0];

      // Log task event
      await this.logTaskEvent(client, taskId, 'start', userId, {
        previous_status: task.status,
        assigned_to: userId,
      });

      // If this is auto-assignment (task was pending), log assignment
      if (task.status === 'pending') {
        await client.query(
          `INSERT INTO task_assignments (task_id, assigned_to, assignment_method, priority_score)
           VALUES ($1, $2, 'pull_queue', $3)`,
          [taskId, userId, task.ai_confidence || 0]
        );
      }

      await client.query('COMMIT');
      return this.buildTaskWithAnnotations(updatedTask);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Save annotation draft
   */
  async saveAnnotationDraft(
    taskId: string, 
    annotation: AnnotationRequest, 
    userId: string
  ): Promise<LabelsDraft> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify task is in progress by this user
      await this.verifyTaskOwnership(client, taskId, userId);

      // Upsert draft annotation
      const result = await client.query(
        `INSERT INTO labels_draft (task_id, payload, updated_by, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (task_id) 
         DO UPDATE SET payload = EXCLUDED.payload, updated_by = EXCLUDED.updated_by, updated_at = NOW()
         RETURNING *`,
        [taskId, JSON.stringify(annotation), userId]
      );

      // Log task event
      await this.logTaskEvent(client, taskId, 'annotate_draft', userId, annotation);

      await client.query('COMMIT');
      return {
        ...result.rows[0],
        payload: annotation,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Submit final task annotation
   */
  async submitTaskAnnotation(
    taskId: string,
    annotation: AnnotationRequest,
    userId: string,
    idempotencyKey?: string
  ): Promise<TaskWithAnnotations> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Check idempotency key if provided
      if (idempotencyKey) {
        const existingResult = await client.query(
          `SELECT task_id FROM task_events 
           WHERE task_id = $1 AND type = 'submit' AND meta->>'idempotency_key' = $2`,
          [taskId, idempotencyKey]
        );
        
        if (existingResult.rows.length > 0) {
          // Already submitted with this key, return existing result
          const taskResult = await client.query(
            `SELECT t.*, ld.payload as draft_payload, lf.* as final_data
             FROM tasks t
             LEFT JOIN labels_draft ld ON ld.task_id = t.id
             LEFT JOIN labels_final lf ON lf.task_id = t.id
             WHERE t.id = $1`,
            [taskId]
          );
          
          await client.query('COMMIT');
          return this.buildTaskWithAnnotations(taskResult.rows[0]);
        }
      }

      // Verify task is in progress by this user
      const task = await this.verifyTaskOwnership(client, taskId, userId);

      // Calculate duration
      let durationMs: number | null = null;
      if (task.started_at) {
        durationMs = Date.now() - new Date(task.started_at).getTime();
      }

      // Save final annotation
      await client.query(
        `INSERT INTO labels_final 
         (task_id, scan_type, result_return, feedback_correction, note, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (task_id) 
         DO UPDATE SET 
           scan_type = EXCLUDED.scan_type,
           result_return = EXCLUDED.result_return,
           feedback_correction = EXCLUDED.feedback_correction,
           note = EXCLUDED.note,
           created_by = EXCLUDED.created_by,
           created_at = NOW()`,
        [
          taskId,
          annotation.scan_type,
          annotation.result_return,
          annotation.feedback_correction,
          annotation.note,
          userId,
        ]
      );

      // Update task status to completed
      const taskResult = await client.query(
        `UPDATE tasks 
         SET status = 'completed', completed_at = NOW(), duration_ms = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [durationMs, taskId]
      );

      // Clear draft
      await client.query(
        'DELETE FROM labels_draft WHERE task_id = $1',
        [taskId]
      );

      // Log task event
      await this.logTaskEvent(client, taskId, 'submit', userId, {
        ...annotation,
        duration_ms: durationMs,
        idempotency_key: idempotencyKey,
      });

      await client.query('COMMIT');
      return this.buildTaskWithAnnotations(taskResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Skip a task
   */
  async skipTask(taskId: string, userId: string, reasonCode?: string): Promise<{ task: TaskWithAnnotations; nextTask?: any }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get task
      const task = await this.verifyTaskOwnership(client, taskId, userId, false); // Allow skip even if not assigned to user

      // Determine skip policy (for now, return to queue)
      const returnToQueue = true; // This could be configurable
      
      let newStatus: TaskStatus;
      let updatedTask;
      
      if (returnToQueue) {
        // Return to pending queue
        const result = await client.query(
          `UPDATE tasks 
           SET status = 'pending', assigned_to = NULL, assigned_at = NULL, started_at = NULL, updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [taskId]
        );
        newStatus = 'pending';
        updatedTask = result.rows[0];
      } else {
        // Mark as permanently skipped
        const result = await client.query(
          `UPDATE tasks 
           SET status = 'skipped', updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [taskId]
        );
        newStatus = 'skipped';
        updatedTask = result.rows[0];
      }

      // Log assignment as skip
      await client.query(
        `INSERT INTO task_assignments (task_id, assigned_to, assignment_method, priority_score)
         VALUES ($1, $2, 'skip', $3)`,
        [taskId, userId, task.ai_confidence || 0]
      );

      // Log task event
      await this.logTaskEvent(client, taskId, 'skip', userId, {
        reason_code: reasonCode,
        previous_status: task.status,
        return_to_queue: returnToQueue,
        new_status: newStatus,
      });

      // Clear any draft
      await client.query('DELETE FROM labels_draft WHERE task_id = $1', [taskId]);

      await client.query('COMMIT');
      
      return {
        task: this.buildTaskWithAnnotations(updatedTask),
        nextTask: null, // Could implement getting next task here
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verify task ownership
   */
  private async verifyTaskOwnership(
    client: any, 
    taskId: string, 
    userId: string, 
    requireOwnership: boolean = true
  ): Promise<any> {
    const result = await client.query(
      `SELECT * FROM tasks WHERE id = $1`,
      [taskId]
    );

    if (result.rows.length === 0) {
      throw new Error('Task not found');
    }

    const task = result.rows[0];

    if (requireOwnership) {
      if (task.status !== 'in_progress') {
        throw new Error(`Task must be in progress to perform this action. Current status: ${task.status}`);
      }

      if (task.assigned_to !== userId) {
        throw new Error('Task is not assigned to this user');
      }
    }

    return task;
  }

  /**
   * Log task event
   */
  private async logTaskEvent(
    client: any,
    taskId: string,
    eventType: TaskEventType,
    userId: string,
    meta?: Record<string, any>
  ): Promise<void> {
    await client.query(
      `INSERT INTO task_events (task_id, type, user_id, meta, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [taskId, eventType, userId, meta ? JSON.stringify(meta) : null]
    );
  }

  /**
   * Build task with annotations
   */
  private buildTaskWithAnnotations(task: any): TaskWithAnnotations {
    return {
      ...task,
      draft: task.draft_payload ? {
        id: task.draft_id,
        task_id: task.id,
        payload: task.draft_payload,
        updated_by: task.draft_updated_by,
        updated_at: task.draft_updated_at,
      } : undefined,
      final: task.final_data ? {
        id: task.final_id,
        task_id: task.id,
        scan_type: task.final_scan_type,
        result_return: task.final_result_return,
        feedback_correction: task.final_feedback_correction,
        note: task.final_note,
        created_by: task.final_created_by,
        created_at: task.final_created_at,
      } : undefined,
    };
  }
}
