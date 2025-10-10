import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { healthCheckSchema, userSchema } from '@monorepo/shared';
import { Pool } from 'pg';
import { importRoutes } from './routes/import.routes.js';
import { taskRoutes } from './routes/task.routes.js';
import { feedbackRoutes } from './routes/feedback.routes.js';
import { reviewRoutes } from './routes/review.routes.js';
import { exportRoutes } from './routes/export.routes.js';
import { analyticsRoutes } from './routes/analytics.routes.js';

const fastify = Fastify({
  logger: true,
});

// CORS configuration
await fastify.register(cors, {
  origin: true,
});

// Multipart support for file uploads
await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Database connection
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'monorepo',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
});

// Health check endpoint
fastify.get('/health', async (_request, reply) => {
  const timestamp = new Date();
  
  try {
    // Check database
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    const dbLatency = Date.now() - dbStart;

    const health = {
      status: 'healthy' as const,
      timestamp,
      services: {
        database: {
          status: 'up' as const,
          latency: dbLatency,
        },
      },
    };

    // Validate with shared schema
    healthCheckSchema.parse(health);

    return reply.code(200).send(health);
  } catch (error) {
    fastify.log.error(error);
    return reply.code(503).send({
      status: 'unhealthy',
      timestamp,
      services: {
        database: {
          status: 'down' as const,
        },
      },
    });
  }
});

// Sample users endpoint
fastify.get('/users', async (_request, reply) => {
  try {
    const result = await pool.query('SELECT * FROM users LIMIT 10');
    return reply.code(200).send({
      success: true,
      data: result.rows,
      timestamp: new Date(),
    });
  } catch (error) {
    fastify.log.error(error);
    return reply.code(500).send({
      success: false,
      error: 'Failed to fetch users',
      timestamp: new Date(),
    });
  }
});

// Sample create user endpoint
fastify.post('/users', async (request, reply) => {
  try {
    const userData = userSchema.omit({ id: true, createdAt: true, updatedAt: true }).parse(request.body);
    
    const result = await pool.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
      [userData.email, userData.name]
    );

    return reply.code(201).send({
      success: true,
      data: result.rows[0],
      timestamp: new Date(),
    });
  } catch (error) {
    fastify.log.error(error);
    return reply.code(400).send({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request',
      timestamp: new Date(),
    });
  }
});

// Import routes
await importRoutes(fastify, pool);

// Task routes
await taskRoutes(fastify, pool);

// Feedback routes
await feedbackRoutes(fastify, pool);

// Review routes
await reviewRoutes(fastify, pool);

// Export and snapshot routes
await exportRoutes(fastify, pool);

// Analytics routes
await analyticsRoutes(fastify, pool);

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '4000');
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    fastify.log.info(`API server running on http://${host}:${port}`);
    
    // Start alert monitoring if enabled
    if (process.env.ENABLE_ALERT_MONITORING === 'true') {
      try {
        const { AlertService } = await import('./services/alert.service.js');
        const alertService = AlertService.getInstance();
        const interval = parseInt(process.env.ALERT_EVALUATION_INTERVAL || '60') * 1000;
        await alertService.start(interval);
        fastify.log.info(`Alert monitoring started with ${interval / 1000}s interval`);
      } catch (error) {
        fastify.log.error('Failed to start alert monitoring:', error);
      }
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
