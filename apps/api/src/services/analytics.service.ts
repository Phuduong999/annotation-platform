import { Pool } from 'pg';
import { getPool } from '../config/database.js';
import { 
  MetricType, 
  AggregationPeriod, 
  AlertSeverity, 
  AlertStatus,
  TimeSeriesData,
  KPIDashboard,
  Alert,
  AlertRule,
  LeaderboardEntry,
  InterAnnotatorAgreementScore,
  ProjectSummary,
  AnalyticsExportData,
  KPI
} from '../types/analytics';
import { MetricsService } from './metrics.service';
import { Parser } from 'json2csv';

export class AnalyticsService {
  private pool: Pool;
  private metricsService: MetricsService;

  constructor() {
    this.pool = getPool();
    this.metricsService = MetricsService.getInstance(this.pool);
  }

  async getCurrentMetrics(params: {
    projectId?: string;
    userId: string;
  }): Promise<Record<string, any>> {
    const metrics: Record<string, any> = {};

    // Get real-time metrics from database
    const queries = [
      {
        name: 'taskThroughput',
        sql: `
          SELECT COUNT(*) as value
          FROM tasks
          WHERE status = 'completed'
            AND completed_at >= NOW() - INTERVAL '1 hour'
            ${params.projectId ? 'AND project_id = $1' : ''}
        `,
      },
      {
        name: 'acceptanceRate',
        sql: `
          SELECT 
            CASE 
              WHEN COUNT(*) > 0 
              THEN (SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END)::float / COUNT(*)) * 100
              ELSE 0
            END as value
          FROM reviews
          WHERE created_at >= NOW() - INTERVAL '24 hours'
            ${params.projectId ? 'AND project_id = $1' : ''}
        `,
      },
      {
        name: 'activeUsers',
        sql: `
          SELECT COUNT(DISTINCT user_id) as value
          FROM user_activity
          WHERE last_activity >= NOW() - INTERVAL '15 minutes'
            ${params.projectId ? 'AND project_id = $1' : ''}
        `,
      },
      {
        name: 'queueSize',
        sql: `
          SELECT COUNT(*) as value
          FROM tasks
          WHERE status IN ('pending', 'in_progress')
            ${params.projectId ? 'AND project_id = $1' : ''}
        `,
      },
    ];

    for (const query of queries) {
      const values = params.projectId ? [params.projectId] : [];
      const result = await this.pool.query(query.sql, values);
      metrics[query.name] = result.rows[0]?.value || 0;
    }

    // Add Prometheus metrics
    const promMetrics = await this.metricsService.getJsonMetrics();
    metrics.prometheus = promMetrics;

    return metrics;
  }

  async getTimeSeries(params: {
    metricType: MetricType;
    startDate: string;
    endDate: string;
    aggregation?: AggregationPeriod;
    projectId?: string;
    userId: string;
  }): Promise<TimeSeriesData> {
    const aggregation = params.aggregation || AggregationPeriod.HOUR;
    
    const query = `
      SELECT 
        date_trunc($1, recorded_at) as timestamp,
        AVG(value) as value,
        COUNT(*) as count
      FROM metrics_history
      WHERE metric_type = $2
        AND recorded_at BETWEEN $3 AND $4
        ${params.projectId ? 'AND project_id = $5' : ''}
      GROUP BY date_trunc($1, recorded_at)
      ORDER BY timestamp ASC
    `;

    const values = [
      aggregation,
      params.metricType,
      params.startDate,
      params.endDate,
      ...(params.projectId ? [params.projectId] : [])
    ];

    const result = await this.pool.query(query, values);

    return {
      metricType: params.metricType,
      data: result.rows.map(row => ({
        timestamp: row.timestamp,
        value: parseFloat(row.value),
        count: parseInt(row.count),
      })),
      aggregation,
      projectId: params.projectId,
    };
  }

  async getKPIs(params: {
    period: string;
    projectId?: string;
    compareWithPrevious?: boolean;
    userId: string;
  }): Promise<KPIDashboard> {
    const periodInterval = this.getPeriodInterval(params.period);
    const previousPeriodInterval = this.getPreviousPeriodInterval(params.period);

    const kpiQueries = [
      { name: 'taskThroughput', metricType: MetricType.TASK_THROUGHPUT },
      { name: 'acceptanceRate', metricType: MetricType.ACCEPTANCE_RATE },
      { name: 'reworkRate', metricType: MetricType.REWORK_RATE },
      { name: 'linkErrorRate', metricType: MetricType.LINK_ERROR_RATE },
      { name: 'dislikeRate', metricType: MetricType.DISLIKE_RATE },
      { name: 'interAnnotatorAgreement', metricType: MetricType.INTER_ANNOTATOR_AGREEMENT },
      { name: 'reviewThroughput', metricType: MetricType.REVIEW_THROUGHPUT },
      { name: 'averageCompletionTime', metricType: MetricType.AVERAGE_TASK_COMPLETION_TIME },
      { name: 'activeUsers', metricType: MetricType.ACTIVE_USERS },
      { name: 'queueSize', metricType: MetricType.QUEUE_SIZE },
    ];

    const kpis: Partial<KPIDashboard> = {};

    for (const kpiQuery of kpiQueries) {
      const currentQuery = `
        SELECT 
          AVG(value) as current_value,
          MIN(value) as min_value,
          MAX(value) as max_value
        FROM kpi_aggregations
        WHERE metric_type = $1
          AND aggregation_period = $2
          AND calculated_at >= NOW() - INTERVAL '${periodInterval}'
          ${params.projectId ? 'AND project_id = $3' : ''}
      `;

      const currentValues = [
        kpiQuery.metricType,
        params.period,
        ...(params.projectId ? [params.projectId] : [])
      ];

      const currentResult = await this.pool.query(currentQuery, currentValues);
      const currentValue = parseFloat(currentResult.rows[0]?.current_value || 0);

      let previousValue: number | undefined;
      let change: number | undefined;
      let changePercentage: number | undefined;
      let trend: 'up' | 'down' | 'stable' | undefined;

      if (params.compareWithPrevious) {
        const previousQuery = `
          SELECT AVG(value) as previous_value
          FROM kpi_aggregations
          WHERE metric_type = $1
            AND aggregation_period = $2
            AND calculated_at >= NOW() - INTERVAL '${previousPeriodInterval}'
            AND calculated_at < NOW() - INTERVAL '${periodInterval}'
            ${params.projectId ? 'AND project_id = $3' : ''}
        `;

        const previousResult = await this.pool.query(previousQuery, currentValues);
        previousValue = parseFloat(previousResult.rows[0]?.previous_value || 0);
        
        if (previousValue > 0) {
          change = currentValue - previousValue;
          changePercentage = (change / previousValue) * 100;
          trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
        }
      }

      // Get target if exists
      const targetQuery = `
        SELECT target_value
        FROM kpi_targets
        WHERE metric_type = $1
          AND is_active = true
          ${params.projectId ? 'AND project_id = $2' : ''}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const targetValues = [
        kpiQuery.metricType,
        ...(params.projectId ? [params.projectId] : [])
      ];
      
      const targetResult = await this.pool.query(targetQuery, targetValues);
      const target = targetResult.rows[0]?.target_value;

      kpis[kpiQuery.name as keyof KPIDashboard] = {
        name: kpiQuery.name,
        value: currentValue,
        previousValue,
        change,
        changePercentage,
        trend,
        target: target ? parseFloat(target) : undefined,
        targetMet: target ? currentValue >= parseFloat(target) : undefined,
        period: params.period,
      } as KPI;
    }

    return kpis as KPIDashboard;
  }

  async getLeaderboard(params: {
    period: string;
    metric: string;
    limit?: number;
    projectId?: string;
    organizationId: string;
  }): Promise<LeaderboardEntry[]> {
    const periodInterval = this.getPeriodInterval(params.period);
    const limit = params.limit || 10;

    let query: string;
    let values: any[];

    switch (params.metric) {
      case 'tasks_completed':
        query = `
          SELECT 
            u.id as user_id,
            u.name as user_name,
            u.email as user_email,
            COUNT(t.id) as value,
            ROW_NUMBER() OVER (ORDER BY COUNT(t.id) DESC) as rank
          FROM users u
          LEFT JOIN tasks t ON u.id = t.assigned_to
            AND t.status = 'completed'
            AND t.completed_at >= NOW() - INTERVAL '${periodInterval}'
            ${params.projectId ? 'AND t.project_id = $1' : ''}
          WHERE u.organization_id = ${params.projectId ? '$2' : '$1'}
          GROUP BY u.id, u.name, u.email
          ORDER BY value DESC
          LIMIT ${params.projectId ? '$3' : '$2'}
        `;
        values = params.projectId 
          ? [params.projectId, params.organizationId, limit]
          : [params.organizationId, limit];
        break;

      case 'acceptance_rate':
        query = `
          SELECT 
            u.id as user_id,
            u.name as user_name,
            u.email as user_email,
            CASE 
              WHEN COUNT(r.id) > 0 
              THEN (SUM(CASE WHEN r.status = 'accepted' THEN 1 ELSE 0 END)::float / COUNT(r.id)) * 100
              ELSE 0
            END as value,
            ROW_NUMBER() OVER (
              ORDER BY 
                CASE 
                  WHEN COUNT(r.id) > 0 
                  THEN (SUM(CASE WHEN r.status = 'accepted' THEN 1 ELSE 0 END)::float / COUNT(r.id))
                  ELSE 0
                END DESC
            ) as rank
          FROM users u
          LEFT JOIN reviews r ON u.id = r.reviewer_id
            AND r.created_at >= NOW() - INTERVAL '${periodInterval}'
            ${params.projectId ? 'AND r.project_id = $1' : ''}
          WHERE u.organization_id = ${params.projectId ? '$2' : '$1'}
          GROUP BY u.id, u.name, u.email
          ORDER BY value DESC
          LIMIT ${params.projectId ? '$3' : '$2'}
        `;
        values = params.projectId 
          ? [params.projectId, params.organizationId, limit]
          : [params.organizationId, limit];
        break;

      default:
        throw new Error(`Unsupported leaderboard metric: ${params.metric}`);
    }

    const result = await this.pool.query(query, values);

    return result.rows.map(row => ({
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      value: parseFloat(row.value),
      rank: parseInt(row.rank),
    }));
  }

  async getAlerts(params: {
    userId: string;
    status?: string;
    severity?: string;
    limit: number;
    offset: number;
  }): Promise<Alert[]> {
    const query = `
      SELECT 
        a.*,
        ar.name as rule_name
      FROM alerts a
      JOIN alert_rules ar ON a.rule_id = ar.id
      WHERE 1=1
        ${params.status ? 'AND a.status = $1' : ''}
        ${params.severity ? `AND a.severity = ${params.status ? '$2' : '$1'}` : ''}
      ORDER BY a.triggered_at DESC
      LIMIT ${params.status && params.severity ? '$3' : params.status || params.severity ? '$2' : '$1'}
      OFFSET ${params.status && params.severity ? '$4' : params.status || params.severity ? '$3' : '$2'}
    `;

    const values = [
      ...(params.status ? [params.status] : []),
      ...(params.severity ? [params.severity] : []),
      params.limit,
      params.offset,
    ].filter(Boolean);

    const result = await this.pool.query(query, values);

    return result.rows.map(row => ({
      id: row.id,
      ruleId: row.rule_id,
      ruleName: row.rule_name,
      severity: row.severity,
      status: row.status,
      message: row.message,
      metricValue: parseFloat(row.metric_value),
      threshold: parseFloat(row.threshold),
      projectId: row.project_id,
      triggeredAt: row.triggered_at,
      acknowledgedAt: row.acknowledged_at,
      acknowledgedBy: row.acknowledged_by,
      resolvedAt: row.resolved_at,
      metadata: row.metadata,
    }));
  }

  async createAlertRule(params: AlertRule & { createdBy: string }): Promise<AlertRule> {
    const query = `
      INSERT INTO alert_rules (
        name, metric_type, condition, threshold, 
        evaluation_period, project_id, is_active, 
        notification_channels, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      params.name,
      params.metricType,
      params.condition,
      params.threshold,
      params.evaluationPeriod,
      params.projectId,
      params.isActive,
      params.notificationChannels ? JSON.stringify(params.notificationChannels) : null,
      params.createdBy,
    ];

    const result = await this.pool.query(query, values);
    return this.mapAlertRule(result.rows[0]);
  }

  async updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id') {
        setClause.push(`${this.camelToSnake(key)} = $${paramIndex}`);
        values.push(key === 'notificationChannels' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    });

    values.push(id);

    const query = `
      UPDATE alert_rules
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return this.mapAlertRule(result.rows[0]);
  }

  async deleteAlertRule(id: string): Promise<void> {
    await this.pool.query('DELETE FROM alert_rules WHERE id = $1', [id]);
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<Alert> {
    const query = `
      UPDATE alerts
      SET 
        status = 'acknowledged',
        acknowledged_at = NOW(),
        acknowledged_by = $2
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, [alertId, userId]);
    
    if (result.rows.length === 0) {
      throw new Error('Alert not found');
    }

    return this.mapAlert(result.rows[0]);
  }

  async getInterAnnotatorAgreement(params: {
    projectId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<InterAnnotatorAgreementScore[]> {
    const query = `
      SELECT *
      FROM inter_annotator_agreement
      WHERE 1=1
        ${params.projectId ? 'AND project_id = $1' : ''}
        ${params.startDate ? `AND calculated_at >= ${params.projectId ? '$2' : '$1'}` : ''}
        ${params.endDate ? `AND calculated_at <= ${params.projectId && params.startDate ? '$3' : params.projectId || params.startDate ? '$2' : '$1'}` : ''}
      ORDER BY calculated_at DESC
      LIMIT 100
    `;

    const values = [
      ...(params.projectId ? [params.projectId] : []),
      ...(params.startDate ? [params.startDate] : []),
      ...(params.endDate ? [params.endDate] : []),
    ].filter(Boolean);

    const result = await this.pool.query(query, values);

    return result.rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      taskId: row.task_id,
      annotator1Id: row.annotator1_id,
      annotator2Id: row.annotator2_id,
      agreementScore: parseFloat(row.agreement_score),
      metricType: row.metric_type,
      calculatedAt: row.calculated_at,
      metadata: row.metadata,
    }));
  }

  async getProjectSummary(projectId: string, userId: string): Promise<ProjectSummary> {
    // Get project details
    const projectQuery = await this.pool.query(
      'SELECT name FROM projects WHERE id = $1',
      [projectId]
    );

    const projectName = projectQuery.rows[0]?.name || 'Unknown Project';

    // Get overview stats
    const overviewQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE status != 'deleted') as total_tasks,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tasks,
        (SELECT COUNT(*) FROM reviews WHERE project_id = $1) as total_reviews,
        (SELECT COUNT(DISTINCT assigned_to) FROM tasks WHERE project_id = $1) as total_users,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600) as avg_completion_time
      FROM tasks
      WHERE project_id = $1
    `;

    const overviewResult = await this.pool.query(overviewQuery, [projectId]);
    const overview = overviewResult.rows[0];

    // Get KPIs
    const kpis = await this.getKPIs({
      period: 'month',
      projectId,
      compareWithPrevious: true,
      userId,
    });

    // Get recent activity
    const activityQuery = `
      SELECT 
        created_at as timestamp,
        'task_completed' as activity_type,
        assigned_to as user_id,
        (SELECT name FROM users WHERE id = assigned_to) as user_name,
        'Completed task ' || title as details
      FROM tasks
      WHERE project_id = $1
        AND status = 'completed'
        AND completed_at >= NOW() - INTERVAL '7 days'
      ORDER BY completed_at DESC
      LIMIT 20
    `;

    const activityResult = await this.pool.query(activityQuery, [projectId]);

    // Get top contributors
    const topContributors = await this.getLeaderboard({
      period: 'month',
      metric: 'tasks_completed',
      limit: 5,
      projectId,
      organizationId: '', // This would need to be passed or fetched
    });

    // Get active alerts
    const alerts = await this.getAlerts({
      userId,
      limit: 10,
      offset: 0,
    });

    // Get trends
    const dailyTrend = await this.getTimeSeries({
      metricType: MetricType.TASK_THROUGHPUT,
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
      aggregation: AggregationPeriod.DAY,
      projectId,
      userId,
    });

    const weeklyTrend = await this.getTimeSeries({
      metricType: MetricType.TASK_THROUGHPUT,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
      aggregation: AggregationPeriod.WEEK,
      projectId,
      userId,
    });

    return {
      projectId,
      projectName,
      overview: {
        totalTasks: parseInt(overview.total_tasks),
        completedTasks: parseInt(overview.completed_tasks),
        inProgressTasks: parseInt(overview.in_progress_tasks),
        totalReviews: parseInt(overview.total_reviews),
        totalUsers: parseInt(overview.total_users),
        averageCompletionTime: parseFloat(overview.avg_completion_time) || 0,
      },
      kpis,
      recentActivity: activityResult.rows.map(row => ({
        timestamp: row.timestamp,
        activityType: row.activity_type,
        userId: row.user_id,
        userName: row.user_name,
        details: row.details,
      })),
      topContributors,
      alerts,
      trends: {
        daily: [dailyTrend],
        weekly: [weeklyTrend],
      },
    };
  }

  async exportAnalytics(params: {
    format: 'json' | 'csv';
    startDate: string;
    endDate: string;
    projectId?: string;
    userId: string;
  }): Promise<string | Buffer> {
    const exportData: AnalyticsExportData = {
      metadata: {
        exportDate: new Date(),
        startDate: new Date(params.startDate),
        endDate: new Date(params.endDate),
        projectId: params.projectId,
        format: params.format,
      },
      metrics: [],
      kpis: await this.getKPIs({
        period: 'month',
        projectId: params.projectId,
        userId: params.userId,
      }),
      timeSeries: [],
      alerts: await this.getAlerts({
        userId: params.userId,
        limit: 100,
        offset: 0,
      }),
      leaderboard: [],
    };

    // Get metrics history
    const metricsQuery = `
      SELECT *
      FROM metrics_history
      WHERE recorded_at BETWEEN $1 AND $2
        ${params.projectId ? 'AND project_id = $3' : ''}
      ORDER BY recorded_at DESC
    `;

    const metricsValues = [
      params.startDate,
      params.endDate,
      ...(params.projectId ? [params.projectId] : [])
    ];

    const metricsResult = await this.pool.query(metricsQuery, metricsValues);
    exportData.metrics = metricsResult.rows.map(row => ({
      timestamp: row.recorded_at,
      value: parseFloat(row.value),
      metricType: row.metric_type,
      projectId: row.project_id,
      userId: row.user_id,
      metadata: row.metadata,
    }));

    if (params.format === 'csv') {
      // Flatten data for CSV export
      const flatData = exportData.metrics.map(metric => ({
        timestamp: metric.timestamp,
        metricType: metric.metricType,
        value: metric.value,
        projectId: metric.projectId,
        userId: metric.userId,
      }));

      const json2csvParser = new Parser();
      return json2csvParser.parse(flatData);
    }

    return JSON.stringify(exportData, null, 2);
  }

  private getPeriodInterval(period: string): string {
    const intervals: Record<string, string> = {
      day: '1 day',
      week: '1 week',
      month: '1 month',
      quarter: '3 months',
      year: '1 year',
    };
    return intervals[period] || '1 day';
  }

  private getPreviousPeriodInterval(period: string): string {
    const intervals: Record<string, string> = {
      day: '2 days',
      week: '2 weeks',
      month: '2 months',
      quarter: '6 months',
      year: '2 years',
    };
    return intervals[period] || '2 days';
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private mapAlertRule(row: any): AlertRule {
    return {
      id: row.id,
      name: row.name,
      metricType: row.metric_type,
      condition: row.condition,
      threshold: parseFloat(row.threshold),
      evaluationPeriod: row.evaluation_period,
      projectId: row.project_id,
      isActive: row.is_active,
      notificationChannels: row.notification_channels ? JSON.parse(row.notification_channels) : undefined,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAlert(row: any): Alert {
    return {
      id: row.id,
      ruleId: row.rule_id,
      ruleName: row.rule_name || '',
      severity: row.severity,
      status: row.status,
      message: row.message,
      metricValue: parseFloat(row.metric_value),
      threshold: parseFloat(row.threshold),
      projectId: row.project_id,
      triggeredAt: row.triggered_at,
      acknowledgedAt: row.acknowledged_at,
      acknowledgedBy: row.acknowledged_by,
      resolvedAt: row.resolved_at,
      metadata: row.metadata,
    };
  }
}