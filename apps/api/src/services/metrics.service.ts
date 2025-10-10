import { register, collectDefaultMetrics, Counter, Histogram, Gauge, Summary } from 'prom-client';
import { Pool } from 'pg';

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

// Custom metrics
export const metrics = {
  // Counters
  tasksCreated: new Counter({
    name: 'tasks_created_total',
    help: 'Total number of tasks created',
    labelNames: ['team_id', 'type', 'status'],
  }),

  tasksCompleted: new Counter({
    name: 'tasks_completed_total',
    help: 'Total number of tasks completed',
    labelNames: ['team_id', 'type', 'result'],
  }),

  reviewsProcessed: new Counter({
    name: 'reviews_processed_total',
    help: 'Total number of reviews processed',
    labelNames: ['action', 'reason_code', 'reviewer_id'],
  }),

  linksChecked: new Counter({
    name: 'links_checked_total',
    help: 'Total number of links checked',
    labelNames: ['status', 'error_type'],
  }),

  alertsTriggered: new Counter({
    name: 'alerts_triggered_total',
    help: 'Total number of alerts triggered',
    labelNames: ['metric_type', 'severity'],
  }),

  // Histograms
  taskProcessingTime: new Histogram({
    name: 'task_processing_duration_seconds',
    help: 'Time taken to process tasks',
    labelNames: ['team_id', 'type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  }),

  reviewLatency: new Histogram({
    name: 'review_latency_seconds',
    help: 'Time between task completion and review',
    labelNames: ['team_id'],
    buckets: [60, 300, 600, 1800, 3600, 7200, 14400],
  }),

  linkCheckLatency: new Histogram({
    name: 'link_check_latency_milliseconds',
    help: 'Latency of link health checks',
    labelNames: ['status'],
    buckets: [10, 50, 100, 250, 500, 1000, 2000, 5000],
  }),

  // Gauges
  activeTasks: new Gauge({
    name: 'active_tasks_count',
    help: 'Current number of active tasks',
    labelNames: ['status', 'team_id'],
  }),

  queueDepth: new Gauge({
    name: 'queue_depth',
    help: 'Current depth of task queues',
    labelNames: ['queue_type', 'priority'],
  }),

  acceptanceRate: new Gauge({
    name: 'acceptance_rate_percent',
    help: 'Current acceptance rate percentage',
    labelNames: ['team_id', 'period'],
  }),

  reworkRate: new Gauge({
    name: 'rework_rate_percent',
    help: 'Current rework rate percentage',
    labelNames: ['team_id', 'period'],
  }),

  linkErrorRate: new Gauge({
    name: 'link_error_rate_percent',
    help: 'Current link error rate percentage',
    labelNames: ['error_type'],
  }),

  dislikeRate: new Gauge({
    name: 'dislike_rate_percent',
    help: 'Current dislike rate percentage',
    labelNames: ['category'],
  }),

  iaaScore: new Gauge({
    name: 'iaa_kappa_score',
    help: 'Inter-annotator agreement (Cohen\'s Kappa)',
    labelNames: ['annotator1', 'annotator2'],
  }),

  // Summary for percentiles
  apiResponseTime: new Summary({
    name: 'api_response_time_seconds',
    help: 'API response time in seconds',
    labelNames: ['method', 'route', 'status_code'],
    percentiles: [0.5, 0.9, 0.95, 0.99],
  }),
};

export class MetricsService {
  constructor(private pool: Pool) {}

  // Update metrics from database
  async updateMetrics() {
    try {
      // Update active tasks gauge
      const activeTasksResult = await this.pool.query(`
        SELECT status, team_id, COUNT(*) as count
        FROM tasks
        WHERE status IN ('pending', 'in_progress')
        GROUP BY status, team_id
      `);

      // Reset gauge before setting new values
      metrics.activeTasks.reset();
      activeTasksResult.rows.forEach(row => {
        metrics.activeTasks.set(
          { status: row.status, team_id: row.team_id },
          parseInt(row.count)
        );
      });

      // Update acceptance rate
      const acceptanceResult = await this.pool.query(`
        SELECT 
          t.team_id,
          COUNT(*) FILTER (WHERE r.action = 'accept') * 100.0 / NULLIF(COUNT(*), 0) as rate
        FROM reviews r
        JOIN tasks t ON r.task_id = t.id
        WHERE r.created_at >= NOW() - INTERVAL '1 hour'
        GROUP BY t.team_id
      `);

      metrics.acceptanceRate.reset();
      acceptanceResult.rows.forEach(row => {
        metrics.acceptanceRate.set(
          { team_id: row.team_id, period: 'hour' },
          parseFloat(row.rate) || 0
        );
      });

      // Update rework rate
      const reworkResult = await this.pool.query(`
        SELECT 
          team_id,
          COUNT(*) FILTER (WHERE review_count > 0) * 100.0 / NULLIF(COUNT(*), 0) as rate
        FROM tasks
        WHERE created_at >= NOW() - INTERVAL '1 hour'
        GROUP BY team_id
      `);

      metrics.reworkRate.reset();
      reworkResult.rows.forEach(row => {
        metrics.reworkRate.set(
          { team_id: row.team_id, period: 'hour' },
          parseFloat(row.rate) || 0
        );
      });

      // Update link error rate
      const linkErrorResult = await this.pool.query(`
        SELECT 
          link_status,
          COUNT(*) * 100.0 / (SELECT COUNT(*) FROM assets WHERE created_at >= NOW() - INTERVAL '1 hour') as rate
        FROM assets
        WHERE created_at >= NOW() - INTERVAL '1 hour'
          AND link_status != 'ok'
        GROUP BY link_status
      `);

      metrics.linkErrorRate.reset();
      linkErrorResult.rows.forEach(row => {
        metrics.linkErrorRate.set(
          { error_type: row.link_status },
          parseFloat(row.rate) || 0
        );
      });

      // Update dislike rate
      const dislikeResult = await this.pool.query(`
        SELECT 
          category,
          COUNT(*) FILTER (WHERE reaction = 'dislike') * 100.0 / NULLIF(COUNT(*), 0) as rate
        FROM feedback_events
        WHERE created_at >= NOW() - INTERVAL '1 hour'
        GROUP BY category
      `);

      metrics.dislikeRate.reset();
      dislikeResult.rows.forEach(row => {
        metrics.dislikeRate.set(
          { category: row.category || 'uncategorized' },
          parseFloat(row.rate) || 0
        );
      });

      // Update IAA scores
      const iaaResult = await this.pool.query(`
        SELECT annotator1_id, annotator2_id, kappa_score
        FROM iaa_scores
        WHERE calculation_date = CURRENT_DATE
      `);

      metrics.iaaScore.reset();
      iaaResult.rows.forEach(row => {
        if (row.kappa_score !== null) {
          metrics.iaaScore.set(
            { annotator1: row.annotator1_id, annotator2: row.annotator2_id },
            parseFloat(row.kappa_score)
          );
        }
      });

    } catch (error) {
      console.error('Error updating metrics:', error);
    }
  }

  // Record task creation
  recordTaskCreated(teamId: string, type: string, status: string) {
    metrics.tasksCreated.inc({ team_id: teamId, type, status });
  }

  // Record task completion
  recordTaskCompleted(teamId: string, type: string, result: string, duration: number) {
    metrics.tasksCompleted.inc({ team_id: teamId, type, result });
    metrics.taskProcessingTime.observe({ team_id: teamId, type }, duration);
  }

  // Record review
  recordReview(action: string, reasonCode: string | null, reviewerId: string) {
    metrics.reviewsProcessed.inc({ 
      action, 
      reason_code: reasonCode || 'none', 
      reviewer_id: reviewerId 
    });
  }

  // Record link check
  recordLinkCheck(status: string, errorType: string | null, latency: number) {
    metrics.linksChecked.inc({ status, error_type: errorType || 'none' });
    metrics.linkCheckLatency.observe({ status }, latency);
  }

  // Record API response
  recordApiResponse(method: string, route: string, statusCode: number, duration: number) {
    metrics.apiResponseTime.observe(
      { method, route, status_code: statusCode.toString() },
      duration
    );
  }

  // Record alert
  recordAlert(metricType: string, severity: string) {
    metrics.alertsTriggered.inc({ metric_type: metricType, severity });
  }

  // Get metrics for Prometheus
  async getMetrics(): Promise<string> {
    // Update current metrics from database
    await this.updateMetrics();
    
    // Return Prometheus formatted metrics
    return register.metrics();
  }

  // Get metrics in JSON format
  async getMetricsJson() {
    await this.updateMetrics();
    return register.getMetricsAsJSON();
  }

  // Calculate and store hourly metrics
  async calculateHourlyMetrics() {
    try {
      await this.pool.query('SELECT calculate_hourly_metrics()');
    } catch (error) {
      console.error('Error calculating hourly metrics:', error);
    }
  }

  // Check alert rules
  async checkAlertRules() {
    try {
      await this.pool.query('SELECT check_alert_rules()');
    } catch (error) {
      console.error('Error checking alert rules:', error);
    }
  }

  // Get historical metrics
  async getHistoricalMetrics(
    metricType: string,
    period: 'hour' | 'day' | 'week',
    startDate: Date,
    endDate: Date,
    dimensions?: { teamId?: string; userId?: string; category?: string }
  ) {
    let query = `
      SELECT 
        date_trunc($1, timestamp) as period,
        AVG(metric_value) as avg_value,
        MIN(metric_value) as min_value,
        MAX(metric_value) as max_value,
        COUNT(*) as sample_count
      FROM metrics_history
      WHERE metric_type = $2
        AND timestamp >= $3
        AND timestamp <= $4
    `;

    const params: any[] = [period, metricType, startDate, endDate];
    
    if (dimensions?.teamId) {
      query += ` AND team_id = $${params.length + 1}`;
      params.push(dimensions.teamId);
    }

    if (dimensions?.userId) {
      query += ` AND user_id = $${params.length + 1}`;
      params.push(dimensions.userId);
    }

    if (dimensions?.category) {
      query += ` AND category = $${params.length + 1}`;
      params.push(dimensions.category);
    }

    query += ` GROUP BY date_trunc($1, timestamp) ORDER BY period DESC`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  // Get leaderboard
  async getLeaderboard(metricType: string, period: 'day' | 'week' | 'month') {
    const result = await this.pool.query(`
      SELECT 
        COALESCE(user_id, team_id) as entity,
        AVG(metric_value) as score,
        COUNT(*) as sample_count
      FROM metrics_history
      WHERE metric_type = $1
        AND timestamp >= NOW() - INTERVAL '1 ${period}'
        AND (user_id IS NOT NULL OR team_id IS NOT NULL)
      GROUP BY COALESCE(user_id, team_id)
      ORDER BY score DESC
      LIMIT 20
    `, [metricType]);

    return result.rows;
  }

  // Get bottlenecks
  async getBottlenecks() {
    const result = await this.pool.query(`
      WITH bottlenecks AS (
        SELECT 
          'link_errors' as category,
          link_status as issue,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration
        FROM assets
        WHERE link_status != 'ok'
          AND created_at >= NOW() - INTERVAL '1 day'
        GROUP BY link_status
        
        UNION ALL
        
        SELECT 
          'rejections' as category,
          reason_code as issue,
          COUNT(*) as count,
          NULL as avg_duration
        FROM reviews
        WHERE action = 'reject'
          AND created_at >= NOW() - INTERVAL '1 day'
        GROUP BY reason_code
        
        UNION ALL
        
        SELECT 
          'slow_tasks' as category,
          type as issue,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration
        FROM tasks
        WHERE updated_at - created_at > INTERVAL '1 hour'
          AND created_at >= NOW() - INTERVAL '1 day'
        GROUP BY type
      )
      SELECT * FROM bottlenecks
      ORDER BY category, count DESC
    `);

    return result.rows;
  }
}