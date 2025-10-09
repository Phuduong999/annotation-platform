import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';

export async function reviewRoutes(fastify: FastifyInstance, pool: Pool) {
  // POST /reviews - Create a review
  fastify.post(
    '/reviews',
    {
      schema: {
        body: {
          type: 'object',
          required: ['task_id', 'action'],
          properties: {
            task_id: { type: 'string' },
            action: { type: 'string', enum: ['accept', 'reject', 'request_changes'] },
            reason_code: {
              type: 'string',
              enum: [
                'incorrect_classification',
                'missing_tags',
                'wrong_tags',
                'nutrition_error',
                'incomplete_annotation',
                'guideline_violation',
                'technical_issue',
                'other',
              ],
            },
            reason_details: { type: 'string' },
            original_annotation: { type: 'object' },
            reviewed_annotation: { type: 'object' },
            issues: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field_name: { type: 'string' },
                  issue_type: { type: 'string', enum: ['error', 'warning', 'suggestion', 'comment'] },
                  description: { type: 'string' },
                  original_value: { type: 'string' },
                  suggested_value: { type: 'string' },
                },
                required: ['issue_type', 'description'],
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: {
          task_id: string;
          action: 'accept' | 'reject' | 'request_changes';
          reason_code?: string;
          reason_details?: string;
          original_annotation?: any;
          reviewed_annotation?: any;
          issues?: Array<{
            field_name?: string;
            issue_type: 'error' | 'warning' | 'suggestion' | 'comment';
            description: string;
            original_value?: string;
            suggested_value?: string;
          }>;
        };
      }>,
      reply: FastifyReply
    ) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const {
          task_id,
          action,
          reason_code,
          reason_details,
          original_annotation,
          reviewed_annotation,
          issues = [],
        } = request.body;

        // Validate reason_code is required for rejection
        if (action === 'reject' && !reason_code) {
          return reply.code(400).send({
            success: false,
            error: 'Reason code is required when rejecting a task',
            timestamp: new Date().toISOString(),
          });
        }

        // Mock reviewer_id - in real app this would come from auth
        const reviewer_id = 'reviewer123';

        // Get task to extract annotator info
        const taskResult = await client.query(
          'SELECT * FROM tasks WHERE id = $1',
          [task_id]
        );

        if (taskResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return reply.code(404).send({
            success: false,
            error: 'Task not found',
            timestamp: new Date().toISOString(),
          });
        }

        const task = taskResult.rows[0];

        // Create review record
        const reviewResult = await client.query(
          `INSERT INTO reviews 
           (task_id, reviewer_id, action, reason_code, reason_details, 
            original_annotation, reviewed_annotation)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            task_id,
            reviewer_id,
            action,
            reason_code || null,
            reason_details || null,
            original_annotation ? JSON.stringify(original_annotation) : null,
            reviewed_annotation ? JSON.stringify(reviewed_annotation) : null,
          ]
        );

        const review = reviewResult.rows[0];

        // Create issue records if provided
        for (const issue of issues) {
          await client.query(
            `INSERT INTO review_issues 
             (review_id, task_id, author_id, field_name, issue_type, 
              description, original_value, suggested_value)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              review.id,
              task_id,
              reviewer_id,
              issue.field_name || null,
              issue.issue_type,
              issue.description,
              issue.original_value || null,
              issue.suggested_value || null,
            ]
          );
        }

        // Update review stats
        await client.query(
          `INSERT INTO review_stats 
           (reviewer_id, annotator_id, task_type, total_reviewed, 
            total_accepted, total_rejected, period_date)
           VALUES ($1, $2, $3, 1, $4, $5, CURRENT_DATE)
           ON CONFLICT (reviewer_id, annotator_id, period_date)
           DO UPDATE SET
             total_reviewed = review_stats.total_reviewed + 1,
             total_accepted = review_stats.total_accepted + $4,
             total_rejected = review_stats.total_rejected + $5,
             updated_at = NOW()`,
          [
            reviewer_id,
            task.assigned_to || 'unknown',
            task.type,
            action === 'accept' ? 1 : 0,
            action === 'reject' ? 1 : 0,
          ]
        );

        await client.query('COMMIT');

        // Trigger webhook for stats update (in production, this would be async)
        fastify.log.info(`Review created: ${review.id} - Action: ${action}`);

        return reply.code(201).send({
          success: true,
          data: review,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        await client.query('ROLLBACK');
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      } finally {
        client.release();
      }
    }
  );

  // POST /issues - Add issue to existing review
  fastify.post(
    '/issues',
    {
      schema: {
        body: {
          type: 'object',
          required: ['review_id', 'task_id', 'issue_type', 'description'],
          properties: {
            review_id: { type: 'string' },
            task_id: { type: 'string' },
            field_name: { type: 'string' },
            issue_type: { type: 'string', enum: ['error', 'warning', 'suggestion', 'comment'] },
            description: { type: 'string' },
            original_value: { type: 'string' },
            suggested_value: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: {
          review_id: string;
          task_id: string;
          field_name?: string;
          issue_type: 'error' | 'warning' | 'suggestion' | 'comment';
          description: string;
          original_value?: string;
          suggested_value?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const {
          review_id,
          task_id,
          field_name,
          issue_type,
          description,
          original_value,
          suggested_value,
        } = request.body;

        // Mock author_id - in real app this would come from auth
        const author_id = 'reviewer123';

        const result = await pool.query(
          `INSERT INTO review_issues 
           (review_id, task_id, author_id, field_name, issue_type, 
            description, original_value, suggested_value)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            review_id,
            task_id,
            author_id,
            field_name || null,
            issue_type,
            description,
            original_value || null,
            suggested_value || null,
          ]
        );

        return reply.code(201).send({
          success: true,
          data: result.rows[0],
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

  // GET /reviews/:taskId - Get reviews for a task
  fastify.get(
    '/reviews/:taskId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['taskId'],
          properties: {
            taskId: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: {
          taskId: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { taskId } = request.params;

        const reviewsResult = await pool.query(
          `SELECT r.*, 
            COALESCE(
              json_agg(
                json_build_object(
                  'id', ri.id,
                  'field_name', ri.field_name,
                  'issue_type', ri.issue_type,
                  'description', ri.description,
                  'original_value', ri.original_value,
                  'suggested_value', ri.suggested_value,
                  'resolved', ri.resolved,
                  'created_at', ri.created_at
                ) 
                FILTER (WHERE ri.id IS NOT NULL)
              ), '[]'
            ) as issues
           FROM reviews r
           LEFT JOIN review_issues ri ON r.id = ri.review_id
           WHERE r.task_id = $1
           GROUP BY r.id
           ORDER BY r.created_at DESC`,
          [taskId]
        );

        return reply.code(200).send({
          success: true,
          data: reviewsResult.rows,
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

  // GET /reviews/stats/:reviewerId - Get reviewer statistics
  fastify.get(
    '/reviews/stats/:reviewerId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['reviewerId'],
          properties: {
            reviewerId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            from_date: { type: 'string' },
            to_date: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: {
          reviewerId: string;
        };
        Querystring: {
          from_date?: string;
          to_date?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { reviewerId } = request.params;
        const { from_date, to_date } = request.query;

        let query = `
          SELECT 
            SUM(total_reviewed) as total_reviewed,
            SUM(total_accepted) as total_accepted,
            SUM(total_rejected) as total_rejected,
            AVG(avg_review_time_seconds) as avg_review_time
          FROM review_stats
          WHERE reviewer_id = $1
        `;

        const params: any[] = [reviewerId];

        if (from_date) {
          query += ` AND period_date >= $${params.length + 1}`;
          params.push(from_date);
        }

        if (to_date) {
          query += ` AND period_date <= $${params.length + 1}`;
          params.push(to_date);
        }

        const result = await pool.query(query, params);

        // Get reason code distribution
        const reasonsResult = await pool.query(
          `SELECT reason_code, COUNT(*) as count
           FROM reviews
           WHERE reviewer_id = $1 AND reason_code IS NOT NULL
           GROUP BY reason_code
           ORDER BY count DESC`,
          [reviewerId]
        );

        return reply.code(200).send({
          success: true,
          data: {
            ...result.rows[0],
            reason_distribution: reasonsResult.rows,
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

  // PATCH /issues/:issueId/resolve - Mark issue as resolved
  fastify.patch(
    '/issues/:issueId/resolve',
    {
      schema: {
        params: {
          type: 'object',
          required: ['issueId'],
          properties: {
            issueId: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: {
          issueId: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { issueId } = request.params;
        // Mock resolver - in real app this would come from auth
        const resolved_by = 'user123';

        const result = await pool.query(
          `UPDATE review_issues
           SET resolved = true, resolved_by = $1, resolved_at = NOW()
           WHERE id = $2
           RETURNING *`,
          [resolved_by, issueId]
        );

        if (result.rows.length === 0) {
          return reply.code(404).send({
            success: false,
            error: 'Issue not found',
            timestamp: new Date().toISOString(),
          });
        }

        return reply.code(200).send({
          success: true,
          data: result.rows[0],
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