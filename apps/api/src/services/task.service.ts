import { Pool } from 'pg';
import { ScanTypeEnum } from '@monorepo/shared';

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
   * Create tasks from valid import rows with link_status=ok
   * 
   * STRATEGY: Option 1 implementation
   * - Only creates tasks for valid import_rows where assets have link_status='ok'
   * - Prevents duplicate tasks (idempotent)
   * - Validates ScanTypeEnum values during task creation
   */
  async createTasksFromImportJob(jobId: string): Promise<TaskCreationResult> {
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
        if (row.link_status !== 'ok') {
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

        // Create task with proper field mapping
        await this.pool.query(
          `INSERT INTO tasks 
           (import_row_id, request_id, user_id, team_id, scan_type, user_input, raw_ai_output, ai_confidence, scan_date, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
          [
            row.id,                    // Link to import_row
            requestId,                 // request_id
            rowData.user_id,          // user_id 
            rowData.team_id,          // team_id
            rowData.type,             // CSV 'type' → DB 'scan_type'
            rowData.user_input,       // user_input (image URL)
            parsedAiOutput,           // parsed JSON
            aiConfidence,             // extracted confidence score
            new Date(rowData.date),   // CSV 'date' → DB 'scan_date'
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
}
