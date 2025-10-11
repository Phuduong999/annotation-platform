import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { TaskService } from '../services/task.service.js';
import {
  StartTaskRequest,
  AnnotationRequest,
  SkipTaskRequest,
  validateAnnotation,
  SCAN_TYPES,
  RESULT_RETURNS,
  FEEDBACK_CORRECTIONS,
} from '../types/annotation.types.js';

export async function taskRoutes(fastify: FastifyInstance, pool: Pool) {
  const taskService = new TaskService(pool);

  // GET /tasks - List all tasks with filtering
  fastify.get(
    '/tasks',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'rejected'] },
            user_id: { type: 'string' },
            limit: { type: 'number', default: 100 },
            offset: { type: 'number', default: 0 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          status?: string;
          user_id?: string;
          limit?: number;
          offset?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { status, user_id, limit = 100, offset = 0 } = request.query;

        let query = `
          SELECT 
            t.*,
            json_build_object(
              'reaction', f.reaction,
              'category', f.category,
              'note', f.note
            ) as end_user_feedback
          FROM tasks t
          LEFT JOIN feedback_events f ON t.request_id = f.request_id
          WHERE 1=1
        `;
        const params: any[] = [];
        let paramIndex = 1;

        if (status) {
          query += ` AND t.status = $${paramIndex}`;
          params.push(status);
          paramIndex++;
        }

        if (user_id) {
          query += ` AND t.assigned_to = $${paramIndex}`;
          params.push(user_id);
          paramIndex++;
        }

        query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) FROM tasks WHERE 1=1';
        const countParams: any[] = [];
        let countParamIndex = 1;

        if (status) {
          countQuery += ` AND status = $${countParamIndex}`;
          countParams.push(status);
          countParamIndex++;
        }

        if (user_id) {
          countQuery += ` AND assigned_to = $${countParamIndex}`;
          countParams.push(user_id);
          countParamIndex++;
        }

        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        return reply.code(200).send({
          success: true,
          data: {
            tasks: result.rows,
            pagination: {
              total,
              limit,
              offset,
              hasMore: offset + result.rows.length < total,
            },
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // GET /tasks/:id - Get single task with feedback
  fastify.get(
    '/tasks/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: {
          id: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;

        // Get task details with feedback
        const taskResult = await pool.query(
          `SELECT 
            t.*,
            json_build_object(
              'reaction', f.reaction,
              'category', f.category,
              'note', f.note
            ) as end_user_feedback
          FROM tasks t
          LEFT JOIN feedback_events f ON t.request_id = f.request_id
          WHERE t.id = $1`,
          [id]
        );

        if (taskResult.rows.length === 0) {
          return reply.code(404).send({
            success: false,
            error: 'Task not found',
            timestamp: new Date().toISOString(),
          });
        }

        const task = taskResult.rows[0];

        // Get end-user feedback if exists
        const feedbackResult = await pool.query(
          `SELECT * FROM feedback_events 
           WHERE request_id = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [task.request_id]
        );

        // Attach feedback to task
        if (feedbackResult.rows.length > 0) {
          task.end_user_feedback = feedbackResult.rows[0];
        }

        return reply.code(200).send({
          success: true,
          data: task,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // POST /tasks/create - Create tasks from import job
  fastify.post(
    '/tasks/create',
    {
      schema: {
        body: {
          type: 'object',
          required: ['jobId'],
          properties: {
            jobId: { type: 'string' },
            skipLinkCheck: { type: 'boolean' },
            assignTo: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: {
          jobId: string;
          skipLinkCheck?: boolean;
          assignTo?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { jobId, skipLinkCheck, assignTo } = request.body;

        const result = await taskService.createTasksFromImportJob(jobId, {
          skipLinkCheck: skipLinkCheck || false,
          assignTo: assignTo || undefined,
        });

        return reply.code(200).send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // POST /tasks/assign - Assign tasks using equal-split
  fastify.post(
    '/tasks/assign',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userIds'],
          properties: {
            userIds: {
              type: 'array',
              items: { type: 'string' },
            },
            quotaPerUser: { type: 'number' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: {
          userIds: string[];
          quotaPerUser?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { userIds, quotaPerUser } = request.body;

        const result = await taskService.assignTasksEqualSplit(userIds, quotaPerUser);

        return reply.code(200).send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // GET /tasks/next - Get next task (pull-based queue)
  fastify.get(
    '/tasks/next',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['user_id'],
          properties: {
            user_id: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          user_id: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { user_id } = request.query;

        const task = await taskService.getNextTask(user_id);

        if (!task) {
          return reply.code(404).send({
            success: false,
            error: 'No tasks available',
            timestamp: new Date().toISOString(),
          });
        }

        return reply.code(200).send({
          success: true,
          data: task,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // GET /tasks/stats - Get task statistics
  fastify.get('/tasks/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await taskService.getTaskStats();

      return reply.code(200).send({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /tasks/user/:userId - Get user's tasks
  fastify.get(
    '/tasks/user/:userId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: {
          userId: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { userId } = request.params;

        const tasks = await taskService.getUserTasks(userId);

        return reply.code(200).send({
          success: true,
          data: tasks,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // GET /tasks/assignments - Get assignment logs
  fastify.get(
    '/tasks/assignments',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            method: { type: 'string', enum: ['equal_split', 'pull_queue', 'skip'] },
            limit: { type: 'number' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          user_id?: string;
          method?: string;
          limit?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const logs = await taskService.getAssignmentLogs({
          userId: request.query.user_id,
          method: request.query.method,
          limit: request.query.limit || 100,
        });

        return reply.code(200).send({
          success: true,
          data: logs,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // PUT /tasks/:id/start - Start working on a task
  fastify.put(
    '/tasks/:id/start',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['user_id'],
          properties: {
            user_id: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: StartTaskRequest;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { user_id } = request.body;

        const task = await taskService.startTask(id, user_id);

        return reply.code(200).send({
          success: true,
          data: task,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        
        // Handle specific conflict case
        if (error instanceof Error && error.message.includes('already in progress')) {
          return reply.code(409).send({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
        
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // PUT /tasks/:id/annotate - Save draft annotation
  fastify.put(
    '/tasks/:id/annotate',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['scan_type', 'result_return', 'feedback_correction'],
          properties: {
            scan_type: { type: 'string', enum: SCAN_TYPES },
            result_return: { type: 'string', enum: RESULT_RETURNS },
            feedback_correction: { type: 'string', enum: FEEDBACK_CORRECTIONS },
            note: { type: 'string' },
            draft: { type: 'boolean', default: true },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: AnnotationRequest;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const annotation = request.body;
        
        // Validate annotation
        const errors = validateAnnotation(annotation);
        if (errors.length > 0) {
          return reply.code(400).send({
            success: false,
            error: 'Validation failed',
            details: errors,
            timestamp: new Date().toISOString(),
          });
        }

        const result = await taskService.saveAnnotationDraft(id, annotation, request.headers['x-user-id'] as string || 'unknown');

        return reply.code(200).send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // PUT /tasks/:id/submit - Submit final annotation
  fastify.put(
    '/tasks/:id/submit',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['scan_type', 'result_return', 'feedback_correction'],
          properties: {
            scan_type: { type: 'string', enum: SCAN_TYPES },
            result_return: { type: 'string', enum: RESULT_RETURNS },
            feedback_correction: { type: 'string', enum: FEEDBACK_CORRECTIONS },
            note: { type: 'string' },
          },
        },
        headers: {
          type: 'object',
          properties: {
            'idempotency-key': { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: AnnotationRequest;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const annotation = request.body;
        const idempotencyKey = request.headers['idempotency-key'] as string;
        const userId = request.headers['x-user-id'] as string || 'unknown';
        
        // Validate annotation
        const errors = validateAnnotation(annotation);
        if (errors.length > 0) {
          return reply.code(400).send({
            success: false,
            error: 'Validation failed - all 3 enum fields are required',
            details: errors,
            timestamp: new Date().toISOString(),
          });
        }

        const result = await taskService.submitTaskAnnotation(id, annotation, userId, idempotencyKey);

        return reply.code(200).send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // PUT /tasks/:id/skip - Skip a task
  fastify.put(
    '/tasks/:id/skip',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['user_id'],
          properties: {
            user_id: { type: 'string' },
            reason_code: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: SkipTaskRequest;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { user_id, reason_code } = request.body;

        const result = await taskService.skipTask(id, user_id, reason_code);

        return reply.code(200).send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
}
