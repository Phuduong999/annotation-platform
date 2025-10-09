import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';

export async function feedbackRoutes(fastify: FastifyInstance, pool: Pool) {
  // POST /events/feedback - Receive feedback from end-user system
  fastify.post(
    '/events/feedback',
    {
      schema: {
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

        // Insert feedback event
        const result = await pool.query(
          `INSERT INTO feedback_events 
           (request_id, user_event_id, reaction, category, note, source, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            request_id,
            user_event_id || null,
            reaction,
            category || null,
            note || null,
            source,
            metadata ? JSON.stringify(metadata) : null,
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

  // GET /events/feedback - List feedback with filters
  fastify.get(
    '/events/feedback',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            reaction: { type: 'string', enum: ['like', 'dislike', 'neutral'] },
            category: { type: 'string' },
            source: { type: 'string' },
            from_date: { type: 'string' },
            to_date: { type: 'string' },
            limit: { type: 'number' },
            offset: { type: 'number' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: {
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
          reaction,
          category,
          source,
          from_date,
          to_date,
          limit = 100,
          offset = 0,
        } = request.query;

        let query = 'SELECT * FROM feedback_events WHERE 1=1';
        const params: any[] = [];
        let paramCount = 0;

        if (reaction) {
          query += ` AND reaction = $${++paramCount}`;
          params.push(reaction);
        }

        if (category) {
          query += ` AND category = $${++paramCount}`;
          params.push(category);
        }

        if (source) {
          query += ` AND source = $${++paramCount}`;
          params.push(source);
        }

        if (from_date) {
          query += ` AND created_at >= $${++paramCount}`;
          params.push(from_date);
        }

        if (to_date) {
          query += ` AND created_at <= $${++paramCount}`;
          params.push(to_date);
        }

        query += ` ORDER BY created_at DESC`;
        query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        return reply.code(200).send({
          success: true,
          data: result.rows,
          total: result.rows.length,
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