import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { taskSchema, type Task } from '@monorepo/shared';

// Redis connection
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

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
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker...');
  await worker.close();
  await connection.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing worker...');
  await worker.close();
  await connection.quit();
  process.exit(0);
});

console.log('Worker started, waiting for jobs...');

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
