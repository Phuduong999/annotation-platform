#!/usr/bin/env tsx
/**
 * Test script for link health checker
 * Run with: tsx test-link-health.ts
 */

import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { Pool } from 'pg';

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

// Create queue
const queue = new Queue('linkHealth', { connection });

// Test URLs
const testUrls = [
  {
    requestId: 'test-001',
    url: 'https://picsum.photos/200/300',
    description: 'Valid image (should be OK)',
  },
  {
    requestId: 'test-002',
    url: 'https://httpstat.us/404',
    description: 'Not found (should be 404)',
  },
  {
    requestId: 'test-003',
    url: 'https://httpstat.us/403',
    description: 'Forbidden (should be 403)',
  },
  {
    requestId: 'test-004',
    url: 'https://example.com',
    description: 'HTML page (should be invalid_mime)',
  },
  {
    requestId: 'test-005',
    url: 'https://nonexistent-domain-12345.com/image.jpg',
    description: 'Non-existent domain (should be network_error)',
  },
  {
    requestId: 'test-006',
    url: 'https://via.placeholder.com/150.png',
    description: 'Valid PNG image (should be OK)',
  },
];

async function addTestJobs() {
  console.log('Adding test jobs to linkHealth queue...\n');

  for (const test of testUrls) {
    await queue.add('check', {
      requestId: test.requestId,
      url: test.url,
    });

    console.log(`✓ Added: ${test.requestId} - ${test.description}`);
    console.log(`  URL: ${test.url}\n`);
  }

  console.log(`\n${testUrls.length} jobs added to queue.`);
  console.log('\nWaiting for jobs to complete...');

  // Wait for all jobs to complete
  await waitForJobs();

  // Display results
  await displayResults();

  // Display metrics
  await displayMetrics();

  // Cleanup
  await queue.close();
  await connection.quit();
  await pool.end();

  console.log('\nTest complete!');
  process.exit(0);
}

async function waitForJobs() {
  return new Promise<void>((resolve) => {
    const interval = setInterval(async () => {
      const counts = await queue.getJobCounts('waiting', 'active');
      const remaining = counts.waiting + counts.active;

      if (remaining === 0) {
        clearInterval(interval);
        resolve();
      } else {
        process.stdout.write(`\rProcessing... (${remaining} remaining)`);
      }
    }, 500);
  });
}

async function displayResults() {
  console.log('\n\n' + '='.repeat(80));
  console.log('RESULTS');
  console.log('='.repeat(80) + '\n');

  for (const test of testUrls) {
    const result = await pool.query('SELECT * FROM assets WHERE request_id = $1', [
      test.requestId,
    ]);

    if (result.rows.length > 0) {
      const asset = result.rows[0];
      console.log(`${test.requestId}:`);
      console.log(`  Description: ${test.description}`);
      console.log(`  Status: ${asset.link_status}`);
      console.log(`  Latency: ${asset.latency_ms}ms`);
      console.log(`  Content-Type: ${asset.content_type || 'N/A'}`);
      if (asset.error_message) {
        console.log(`  Error: ${asset.error_message}`);
      }
      console.log('');
    } else {
      console.log(`${test.requestId}: No result found\n`);
    }
  }
}

async function displayMetrics() {
  console.log('='.repeat(80));
  console.log('METRICS');
  console.log('='.repeat(80) + '\n');

  try {
    const response = await fetch('http://localhost:9090/health');
    const data = await response.json();

    console.log('Error Rate:', (data.metrics.errorRate * 100).toFixed(2) + '%');
    console.log('95th Percentile Latency:', data.metrics.latency95p.toFixed(2) + 'ms');
    console.log('\nQueue Stats:');
    console.log('  Waiting:', data.metrics.queueStats.waiting);
    console.log('  Active:', data.metrics.queueStats.active);
    console.log('  Completed:', data.metrics.queueStats.completed);
    console.log('  Failed:', data.metrics.queueStats.failed);
  } catch (error) {
    console.log('Could not fetch metrics (is worker running on port 9090?)');
  }

  console.log('\n' + '='.repeat(80));
}

// Run test
addTestJobs().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
