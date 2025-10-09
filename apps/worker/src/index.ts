import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { taskSchema, type Task } from '@monorepo/shared';
import { LinkHealthQueue } from './queues/link-health.queue.js';
import { getMetrics, getLinkErrorRate, get95thPercentileLatency } from './metrics/prometheus.js';
import http from 'http';

// Redis connection
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Database connection
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'monorepo',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
});

// Initialize link health queue
const linkHealthQueue = new LinkHealthQueue(connection, pool);

// Worker processor
const processTask = async (job: Job<Task>) => {
  console.log(`Processing job ${job.id} of type ${job.data.type}`);
  console.log('Job data:', job.data);

  // Validate job data with shared schema
  const validatedData = taskSchema.parse(job.data);

  try {
    switch (validatedData.type) {
      case 'email':
        await processEmailTask(validatedData);
        break;
      case 'notification':
        await processNotificationTask(validatedData);
        break;
      case 'data-processing':
        await processDataTask(validatedData);
        break;
      default:
        throw new Error(`Unknown task type: ${validatedData.type}`);
    }

    console.log(`Job ${job.id} completed successfully`);
    return { success: true };
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);
    throw error;
  }
};

// Task processors
async function processEmailTask(task: Task): Promise<void> {
  console.log(`Sending email with data:`, task.data);
  // Simulate email sending
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function processNotificationTask(task: Task): Promise<void> {
  console.log(`Sending notification with data:`, task.data);
  // Simulate notification sending
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function processDataTask(task: Task): Promise<void> {
  console.log(`Processing data:`, task.data);
  // Simulate data processing
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

// Create worker
const worker = new Worker('tasks', processTask, {
  connection,
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000,
  },
});

// Worker event handlers
worker.on('completed', (job) => {
  console.log(`✓ Job ${job.id} has completed`);
});

worker.on('failed', (job, err) => {
  console.error(`✗ Job ${job?.id} has failed with error:`, err.message);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down gracefully...`);
  
  // Close metrics server
  metricsServer.close();
  
  // Close workers
  await worker.close();
  await linkHealthQueue.close();
  
  // Close connections
  await connection.quit();
  await pool.end();
  
  console.log('Shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

console.log('Worker started, waiting for jobs...');

// Metrics HTTP server
const metricsServer = http.createServer(async (req, res) => {
  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(await getMetrics());
  } else if (req.url === '/health') {
    const errorRate = await getLinkErrorRate();
    const latency95p = await get95thPercentileLatency();
    const stats = await linkHealthQueue.getStats();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'healthy',
        metrics: {
          errorRate,
          latency95p,
          queueStats: stats,
        },
      })
    );
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const metricsPort = parseInt(process.env.METRICS_PORT || '9090');
metricsServer.listen(metricsPort, () => {
  console.log(`Metrics server running on http://localhost:${metricsPort}`);
  console.log(`  - Prometheus metrics: http://localhost:${metricsPort}/metrics`);
  console.log(`  - Health check: http://localhost:${metricsPort}/health`);
});

// Example: Add a sample job (for testing)
// Uncomment the function below to add a sample job on startup
/*
const addSampleJob = async () => {
  await taskQueue.add('sample-email', {
    id: 'job-1',
    type: 'email',
    data: {
      to: 'user@example.com',
      subject: 'Hello from Worker',
      body: 'This is a test email',
    },
    priority: 5,
  });
  console.log('Sample job added to queue');
};

setTimeout(addSampleJob, 3000);
*/
