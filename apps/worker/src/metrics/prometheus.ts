import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

// Create a custom registry
export const register = new Registry();

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

/**
 * Link error rate counter
 * Tracks the number of link check errors by status
 */
export const linkErrorCounter = new Counter({
  name: 'link_error_total',
  help: 'Total number of link health check errors',
  labelNames: ['status', 'error_type'],
  registers: [register],
});

/**
 * Link check latency histogram
 * Tracks the latency of link health checks with percentiles
 */
export const linkLatencyHistogram = new Histogram({
  name: 'link_check_latency_ms',
  help: 'Link health check latency in milliseconds',
  labelNames: ['status'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000], // milliseconds
  registers: [register],
});

/**
 * Link check success counter
 * Tracks successful link health checks
 */
export const linkSuccessCounter = new Counter({
  name: 'link_success_total',
  help: 'Total number of successful link health checks',
  labelNames: ['status'],
  registers: [register],
});

/**
 * Record link check result metrics
 */
export function recordLinkCheckMetrics(
  status: string,
  latencyMs: number,
  isError: boolean,
  errorType?: string
) {
  // Record latency
  linkLatencyHistogram.labels(status).observe(latencyMs);

  // Record error or success
  if (isError) {
    linkErrorCounter.labels(status, errorType || 'unknown').inc();
  } else {
    linkSuccessCounter.labels(status).inc();
  }
}

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get error rate (errors / total requests)
 */
export async function getLinkErrorRate(): Promise<number> {
  const metrics = await register.getMetricsAsJSON();
  
  let totalErrors = 0;
  let totalSuccess = 0;

  for (const metric of metrics as any[]) {
    if (metric.name === 'link_error_total') {
      for (const value of metric.values) {
        totalErrors += value.value as number;
      }
    }
    if (metric.name === 'link_success_total') {
      for (const value of metric.values) {
        totalSuccess += value.value as number;
      }
    }
  }

  const total = totalErrors + totalSuccess;
  return total > 0 ? totalErrors / total : 0;
}

/**
 * Get 95th percentile latency
 */
export async function get95thPercentileLatency(): Promise<number> {
  const metrics = await register.getMetricsAsJSON();
  
  for (const metric of metrics as any[]) {
    if (metric.name === 'link_check_latency_ms') {
      // Try to find 95th percentile from histogram
      // Note: The actual implementation may vary depending on prom-client version
      return 0; // Placeholder - histogram quantiles are calculated differently
    }
  }

  return 0;
}
