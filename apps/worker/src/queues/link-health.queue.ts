import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { LinkHealthJob, RETRY_CONFIG } from '../types/link-health.js';
import { LinkHealthService } from '../services/link-health.service.js';

const QUEUE_NAME = 'linkHealth';

export class LinkHealthQueue {
  private queue: Queue;
  private worker: Worker;
  private service: LinkHealthService;

  constructor(connection: Redis, pool: Pool) {
    this.service = new LinkHealthService(pool);

    // Create queue for adding jobs
    this.queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: RETRY_CONFIG.attempts,
        backoff: {
          type: RETRY_CONFIG.backoff.type,
          delay: RETRY_CONFIG.backoff.delay,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });

    // Create worker for processing jobs
    this.worker = new Worker<LinkHealthJob>(
      QUEUE_NAME,
      async (job: Job<LinkHealthJob>) => this.processJob(job),
      {
        connection,
        concurrency: 10, // Process up to 10 jobs concurrently
        limiter: {
          max: 50, // Max 50 jobs
          duration: 1000, // Per second
        },
      }
    );

    this.setupEventHandlers();
  }

  /**
   * Process a link health check job
   */
  private async processJob(job: Job<LinkHealthJob>): Promise<void> {
    const { requestId, url } = job.data;

    console.log(
      `[LinkHealth] Processing job ${job.id} for request ${requestId} (attempt ${job.attemptsMade + 1}/${RETRY_CONFIG.attempts})`
    );

    try {
      const result = await this.service.checkLinkHealth(requestId, url);

      console.log(
        `[LinkHealth] ✓ Job ${job.id} completed: ${result.linkStatus} (${result.latencyMs}ms)`
      );

      // Update job progress
      await job.updateProgress(100);

      return;
    } catch (error) {
      console.error(`[LinkHealth] ✗ Job ${job.id} failed:`, error);

      // Determine if error is retryable
      const isRetryable = this.isRetryableError(error);

      if (!isRetryable || job.attemptsMade >= RETRY_CONFIG.attempts - 1) {
        // Don't retry, mark as failed
        throw error;
      }

      // Will be retried automatically by BullMQ
      throw error;
    }
  }

  /**
   * Determine if an error should be retried
   */
  private isRetryableError(error: any): boolean {
    // Network errors should be retried
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return true;
    }

    // Timeout errors should be retried
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // 5xx errors should be retried
    if (error.response?.status >= 500) {
      return true;
    }

    // Other errors (4xx, decode errors, etc.) should not be retried
    return false;
  }

  /**
   * Setup event handlers for monitoring
   */
  private setupEventHandlers(): void {
    // Worker events
    this.worker.on('completed', (job) => {
      console.log(`[LinkHealth] Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`[LinkHealth] Job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      console.error('[LinkHealth] Worker error:', err);
    });

    this.worker.on('stalled', (jobId) => {
      console.warn(`[LinkHealth] Job ${jobId} stalled`);
    });

    // Queue events
    this.queue.on('error', (err) => {
      console.error('[LinkHealth] Queue error:', err);
    });
  }

  /**
   * Add a job to the queue
   */
  async addJob(requestId: string, url: string, priority?: number): Promise<void> {
    await this.queue.add(
      'check',
      { requestId, url },
      {
        priority: priority || 1,
        jobId: `link-${requestId}`, // Prevent duplicate jobs
      }
    );

    console.log(`[LinkHealth] Added job for request ${requestId}`);
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    const counts = await this.queue.getJobCounts('wait', 'active', 'completed', 'failed');
    return {
      waiting: counts.wait,
      active: counts.active,
      completed: counts.completed,
      failed: counts.failed,
    };
  }

  /**
   * Clean up completed and failed jobs
   */
  async clean(): Promise<void> {
    await this.queue.clean(24 * 3600 * 1000, 1000, 'completed'); // 24 hours
    await this.queue.clean(7 * 24 * 3600 * 1000, 1000, 'failed'); // 7 days
  }

  /**
   * Close queue and worker
   */
  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }
}
