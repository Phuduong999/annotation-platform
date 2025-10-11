import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';

export async function feedbackRoutes(fastify: FastifyInstance, pool: Pool) {
  // POST /events/feedback - Receive feedback from end-user system
  fastify.post(
    '/events/feedback',
    {
      schema: {
        headers: {
          type: 'object',
          properties: {
            'idempotency-key': { type: 'string', maxLength: 255 },
          },
        },
        body: {
          type: 'object',
          required: ['request_id', 'reaction'],
          properties: {
            request_id: { type: 'string' },
            user_event_id: { type: 'string' },
            reaction: { type: 'string', enum: ['like', 'dislike', 'neutral'] },
            category: { type: 'string' },
            note: { type: 'string' },
            source: { type: 'string' },
            metadata: { type: 'object' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Headers: {
          'idempotency-key'?: string;
        };
        Body: {
          request_id: string;
          user_event_id?: string;
          reaction: 'like' | 'dislike' | 'neutral';
          category?: string;
          note?: string;
          source?: string;
          metadata?: Record<string, any>;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const {
          request_id,
          user_event_id,
          reaction,
          category,
          note,
          source = 'end_user',
          metadata,
        } = request.body;
        
        const idempotencyKey = request.headers['idempotency-key'];

        // Check for existing feedback with idempotency key first
        if (idempotencyKey) {
          const existingByKey = await pool.query(
            'SELECT * FROM feedback_events WHERE idempotency_key = $1',
            [idempotencyKey]
          );
          
          if (existingByKey.rows.length > 0) {
            // Return existing record with 200 status (idempotent)
            return reply.code(200).send({
              success: true,
              data: existingByKey.rows[0],
              message: 'Feedback already exists (idempotent)',
              timestamp: new Date().toISOString(),
            });
          }
        }

        // Insert feedback event
        const result = await pool.query(
          `INSERT INTO feedback_events 
           (request_id, user_event_id, reaction, category, note, source, metadata, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            request_id,
            user_event_id || null,
            reaction,
            category || null,
            note || null,
            source,
            metadata ? JSON.stringify(metadata) : null,
            idempotencyKey || null,
          ]
        );

        return reply.code(201).send({
          success: true,
          data: result.rows[0],
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error(error);
        
        // Handle unique constraint violations (409 Conflict)
        if (error.code === '23505') { // PostgreSQL unique violation
          if (error.constraint?.includes('unique_request_user_event') || 
              error.constraint?.includes('unique_request_only')) {
            return reply.code(409).send({
              success: false,
              error: 'Feedback already exists for this request',
              error_code: 'DUPLICATE_FEEDBACK',
              details: 'A feedback event already exists for this request_id and user_event_id combination',
              timestamp: new Date().toISOString(),
            });
          }
          
          if (error.constraint?.includes('unique_idempotency_key')) {
            return reply.code(409).send({
              success: false,
              error: 'Duplicate request detected',
              error_code: 'DUPLICATE_IDEMPOTENCY_KEY',
              details: 'This idempotency key has already been used',
              timestamp: new Date().toISOString(),
            });
          }
        }
        
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // GET /events/feedback/:requestId - Get feedback for a specific request
  fastify.get(
    '/events/feedback/:requestId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['requestId'],
          properties: {
            requestId: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: {
          requestId: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { requestId } = request.params;

        // Get latest feedback for this request
        const result = await pool.query(
          `SELECT * FROM feedback_events 
           WHERE request_id = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [requestId]
        );

        if (result.rows.length === 0) {
          return reply.code(404).send({
            success: false,
            error: 'No feedback found for this request',
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

  // GET /events/feedback - List feedback with filters and pagination
  fastify.get(
    '/events/feedback',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            request_id: { type: 'string' },
            reaction: { type: 'string', enum: ['like', 'dislike', 'neutral'] },
            category: { type: 'string' },
            source: { type: 'string' },
            from_date: { type: 'string', format: 'date-time' },
            to_date: { type: 'string', format: 'date-time' },
            limit: { type: 'number', minimum: 1, maximum: 1000, default: 100 },
            offset: { type: 'number', minimum: 0, default: 0 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          request_id?: string;
          reaction?: 'like' | 'dislike' | 'neutral';
          category?: string;
          source?: string;
          from_date?: string;
          to_date?: string;
          limit?: number;
          offset?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const {
          request_id,
          reaction,
          category,
          source,
          from_date,
          to_date,
          limit = 100,
          offset = 0,
        } = request.query;

        // Build WHERE conditions
        let whereClause = 'WHERE 1=1';
        const params: any[] = [];
        let paramCount = 0;

        if (request_id) {
          whereClause += ` AND request_id = $${++paramCount}`;
          params.push(request_id);
        }

        if (reaction) {
          whereClause += ` AND reaction = $${++paramCount}`;
          params.push(reaction);
        }

        if (category) {
          whereClause += ` AND category ILIKE $${++paramCount}`;
          params.push(`%${category}%`);
        }

        if (source) {
          whereClause += ` AND source = $${++paramCount}`;
          params.push(source);
        }

        if (from_date) {
          whereClause += ` AND created_at >= $${++paramCount}`;
          params.push(from_date);
        }

        if (to_date) {
          whereClause += ` AND created_at <= $${++paramCount}`;
          params.push(to_date);
        }

        // Get total count
        const countQuery = `SELECT COUNT(*) FROM feedback_events ${whereClause}`;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // Get paginated results
        const dataQuery = `
          SELECT id, request_id, user_event_id, reaction, category, note, 
                 source, metadata, created_at, idempotency_key
          FROM feedback_events 
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        params.push(limit, offset);
        
        const dataResult = await pool.query(dataQuery, params);

        return reply.code(200).send({
          success: true,
          data: {
            events: dataResult.rows,
            total,
            limit,
            offset,
            has_more: offset + limit < total,
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

  // GET /feedback/categories - Get unique feedback categories
  fastify.get('/feedback/categories', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await pool.query(
        `SELECT DISTINCT category, COUNT(*) as count
         FROM feedback_events
         WHERE category IS NOT NULL
         GROUP BY category
         ORDER BY count DESC`
      );

      return reply.code(200).send({
        success: true,
        data: result.rows,
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

  // GET /feedback/stats - Get feedback statistics
  fastify.get('/feedback/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await pool.query(
        `SELECT 
          COUNT(*) FILTER (WHERE reaction = 'like') as likes,
          COUNT(*) FILTER (WHERE reaction = 'dislike') as dislikes,
          COUNT(*) FILTER (WHERE reaction = 'neutral') as neutral,
          COUNT(*) as total,
          COUNT(DISTINCT request_id) as unique_requests,
          COUNT(DISTINCT category) as unique_categories
         FROM feedback_events`
      );

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
  });
}