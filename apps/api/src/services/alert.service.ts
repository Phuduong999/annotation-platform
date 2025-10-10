import { Pool } from 'pg';
import { getPool } from '../config/database';
import { 
  AlertRule, 
  Alert, 
  AlertSeverity, 
  AlertStatus,
  MetricType 
} from '../types/analytics';
import { MetricsService } from './metrics.service';
import { EventEmitter } from 'events';

interface AlertNotification {
  alert: Alert;
  rule: AlertRule;
  channel: string;
}

export class AlertService extends EventEmitter {
  private static instance: AlertService;
  private pool: Pool;
  private metricsService: MetricsService;
  private evaluationInterval: NodeJS.Timeout | null = null;
  private activeRules: Map<string, AlertRule> = new Map();
  private recentAlerts: Map<string, Date> = new Map(); // For deduplication

  private constructor() {
    super();
    this.pool = getPool();
    this.metricsService = MetricsService.getInstance();
  }

  static getInstance(): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService();
    }
    return AlertService.instance;
  }

  /**
   * Start the alert monitoring engine
   */
  async start(intervalMs: number = 60000): Promise<void> {
    console.log('Starting alert monitoring engine...');
    
    // Load active alert rules
    await this.loadActiveRules();
    
    // Start evaluation loop
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }
    
    this.evaluationInterval = setInterval(async () => {
      await this.evaluateAllRules();
    }, intervalMs);
    
    // Run initial evaluation
    await this.evaluateAllRules();
    
    console.log(`Alert engine started with ${this.activeRules.size} active rules`);
  }

  /**
   * Stop the alert monitoring engine
   */
  stop(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }
    console.log('Alert monitoring engine stopped');
  }

  /**
   * Load active alert rules from database
   */
  private async loadActiveRules(): Promise<void> {
    const query = `
      SELECT * FROM alert_rules 
      WHERE is_active = true
    `;
    
    const result = await this.pool.query(query);
    
    this.activeRules.clear();
    for (const row of result.rows) {
      const rule = this.mapRowToAlertRule(row);
      this.activeRules.set(rule.id, rule);
    }
  }

  /**
   * Evaluate all active rules
   */
  private async evaluateAllRules(): Promise<void> {
    const evaluationPromises = Array.from(this.activeRules.values()).map(rule =>
      this.evaluateRule(rule).catch(error => {
        console.error(`Error evaluating rule ${rule.id}:`, error);
      })
    );
    
    await Promise.all(evaluationPromises);
  }

  /**
   * Evaluate a single alert rule
   */
  private async evaluateRule(rule: AlertRule): Promise<void> {
    try {
      // Get current metric value
      const metricValue = await this.getCurrentMetricValue(
        rule.metricType,
        rule.projectId
      );
      
      if (metricValue === null) {
        return; // No data available
      }
      
      // Check if threshold is breached
      const isBreached = this.checkThreshold(
        metricValue,
        rule.threshold,
        rule.condition
      );
      
      if (isBreached) {
        // Check for existing active alert for this rule
        const existingAlert = await this.getActiveAlertForRule(rule.id);
        
        if (!existingAlert) {
          // Create new alert
          await this.createAlert(rule, metricValue);
        } else {
          // Update existing alert if metric value changed significantly
          await this.updateAlertIfNeeded(existingAlert, metricValue);
        }
      } else {
        // Resolve any active alerts for this rule
        await this.resolveAlertsForRule(rule.id);
      }
    } catch (error) {
      console.error(`Failed to evaluate rule ${rule.id}:`, error);
    }
  }

  /**
   * Get current value for a metric
   */
  private async getCurrentMetricValue(
    metricType: MetricType,
    projectId?: string
  ): Promise<number | null> {
    const query = `
      SELECT AVG(value) as avg_value
      FROM metrics_history
      WHERE metric_type = $1
        ${projectId ? 'AND project_id = $2' : ''}
        AND recorded_at >= NOW() - INTERVAL '5 minutes'
    `;
    
    const values = projectId ? [metricType, projectId] : [metricType];
    const result = await this.pool.query(query, values);
    
    return result.rows[0]?.avg_value || null;
  }

  /**
   * Check if a threshold is breached
   */
  private checkThreshold(
    value: number,
    threshold: number,
    condition: 'greater_than' | 'less_than' | 'equals'
  ): boolean {
    switch (condition) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return Math.abs(value - threshold) < 0.001; // Float comparison tolerance
      default:
        return false;
    }
  }

  /**
   * Get active alert for a rule
   */
  private async getActiveAlertForRule(ruleId: string): Promise<Alert | null> {
    const query = `
      SELECT * FROM alerts
      WHERE rule_id = $1
        AND status IN ('active', 'acknowledged')
      ORDER BY triggered_at DESC
      LIMIT 1
    `;
    
    const result = await this.pool.query(query, [ruleId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToAlert(result.rows[0]);
  }

  /**
   * Create a new alert
   */
  private async createAlert(rule: AlertRule, metricValue: number): Promise<Alert> {
    // Check for recent duplicate alerts (deduplication)
    const dedupKey = `${rule.id}-${Math.floor(metricValue)}`;
    const lastAlertTime = this.recentAlerts.get(dedupKey);
    
    if (lastAlertTime && Date.now() - lastAlertTime.getTime() < 300000) { // 5 minutes
      throw new Error('Duplicate alert suppressed');
    }
    
    const severity = this.calculateSeverity(metricValue, rule.threshold, rule.condition);
    const message = this.generateAlertMessage(rule, metricValue);
    
    const query = `
      INSERT INTO alerts (
        rule_id, severity, status, message,
        metric_value, threshold, project_id, triggered_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;
    
    const values = [
      rule.id,
      severity,
      AlertStatus.ACTIVE,
      message,
      metricValue,
      rule.threshold,
      rule.projectId,
    ];
    
    const result = await this.pool.query(query, values);
    const alert = this.mapRowToAlert(result.rows[0]);
    
    // Update deduplication cache
    this.recentAlerts.set(dedupKey, new Date());
    
    // Clean old entries from cache
    this.cleanRecentAlertsCache();
    
    // Emit notification event
    await this.notifyAlert(alert, rule);
    
    // Update metrics
    this.metricsService.recordAlert(severity);
    
    return alert;
  }

  /**
   * Update an existing alert if metric value changed significantly
   */
  private async updateAlertIfNeeded(alert: Alert, newMetricValue: number): Promise<void> {
    const percentChange = Math.abs(
      (newMetricValue - alert.metricValue) / alert.metricValue
    ) * 100;
    
    // Update if value changed by more than 10%
    if (percentChange > 10) {
      const query = `
        UPDATE alerts
        SET metric_value = $2,
            updated_at = NOW()
        WHERE id = $1
      `;
      
      await this.pool.query(query, [alert.id, newMetricValue]);
    }
  }

  /**
   * Resolve alerts for a rule when threshold is no longer breached
   */
  private async resolveAlertsForRule(ruleId: string): Promise<void> {
    const query = `
      UPDATE alerts
      SET status = $2,
          resolved_at = NOW()
      WHERE rule_id = $1
        AND status IN ('active', 'acknowledged')
    `;
    
    await this.pool.query(query, [ruleId, AlertStatus.RESOLVED]);
  }

  /**
   * Calculate alert severity based on how much the threshold is exceeded
   */
  private calculateSeverity(
    value: number,
    threshold: number,
    condition: 'greater_than' | 'less_than' | 'equals'
  ): AlertSeverity {
    let exceedanceRatio: number;
    
    if (condition === 'greater_than') {
      exceedanceRatio = value / threshold;
    } else if (condition === 'less_than') {
      exceedanceRatio = threshold / value;
    } else {
      return AlertSeverity.LOW;
    }
    
    if (exceedanceRatio >= 2) {
      return AlertSeverity.CRITICAL;
    } else if (exceedanceRatio >= 1.5) {
      return AlertSeverity.HIGH;
    } else if (exceedanceRatio >= 1.2) {
      return AlertSeverity.MEDIUM;
    } else {
      return AlertSeverity.LOW;
    }
  }

  /**
   * Generate human-readable alert message
   */
  private generateAlertMessage(rule: AlertRule, metricValue: number): string {
    const metricName = this.getMetricDisplayName(rule.metricType);
    const conditionText = rule.condition.replace('_', ' ');
    
    return `${metricName} is ${conditionText} threshold: ${metricValue.toFixed(2)} (threshold: ${rule.threshold})`;
  }

  /**
   * Get display name for metric type
   */
  private getMetricDisplayName(metricType: MetricType): string {
    const displayNames: Record<MetricType, string> = {
      [MetricType.TASK_THROUGHPUT]: 'Task Throughput',
      [MetricType.ACCEPTANCE_RATE]: 'Acceptance Rate',
      [MetricType.REWORK_RATE]: 'Rework Rate',
      [MetricType.LINK_ERROR_RATE]: 'Link Error Rate',
      [MetricType.DISLIKE_RATE]: 'Dislike Rate',
      [MetricType.INTER_ANNOTATOR_AGREEMENT]: 'Inter-Annotator Agreement',
      [MetricType.REVIEW_THROUGHPUT]: 'Review Throughput',
      [MetricType.AVERAGE_TASK_COMPLETION_TIME]: 'Average Task Completion Time',
      [MetricType.ACTIVE_USERS]: 'Active Users',
      [MetricType.QUEUE_SIZE]: 'Queue Size',
      [MetricType.API_RESPONSE_TIME]: 'API Response Time',
      [MetricType.ERROR_RATE]: 'Error Rate',
    };
    
    return displayNames[metricType] || metricType;
  }

  /**
   * Send alert notifications
   */
  private async notifyAlert(alert: Alert, rule: AlertRule): Promise<void> {
    // Emit event for each notification channel
    if (rule.notificationChannels) {
      for (const channel of rule.notificationChannels) {
        const notification: AlertNotification = {
          alert,
          rule,
          channel,
        };
        
        this.emit('alert', notification);
        
        // Log notification
        console.log(`Alert triggered: ${alert.message} [${alert.severity}] via ${channel}`);
        
        // Channel-specific handling
        await this.sendChannelNotification(channel, alert, rule);
      }
    } else {
      // Default notification
      this.emit('alert', { alert, rule, channel: 'default' });
      console.log(`Alert triggered: ${alert.message} [${alert.severity}]`);
    }
  }

  /**
   * Send notification to specific channel
   */
  private async sendChannelNotification(
    channel: string,
    alert: Alert,
    rule: AlertRule
  ): Promise<void> {
    switch (channel) {
      case 'email':
        await this.sendEmailNotification(alert, rule);
        break;
      case 'slack':
        await this.sendSlackNotification(alert, rule);
        break;
      case 'webhook':
        await this.sendWebhookNotification(alert, rule);
        break;
      case 'database':
        // Already stored in database
        break;
      default:
        console.warn(`Unknown notification channel: ${channel}`);
    }
  }

  /**
   * Send email notification (placeholder)
   */
  private async sendEmailNotification(alert: Alert, rule: AlertRule): Promise<void> {
    // TODO: Implement email notification
    console.log(`Email notification would be sent for alert: ${alert.id}`);
  }

  /**
   * Send Slack notification (placeholder)
   */
  private async sendSlackNotification(alert: Alert, rule: AlertRule): Promise<void> {
    // TODO: Implement Slack notification
    console.log(`Slack notification would be sent for alert: ${alert.id}`);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(alert: Alert, rule: AlertRule): Promise<void> {
    try {
      const webhookUrl = process.env.ALERT_WEBHOOK_URL;
      if (!webhookUrl) {
        console.warn('ALERT_WEBHOOK_URL not configured');
        return;
      }
      
      const payload = {
        alert: {
          id: alert.id,
          severity: alert.severity,
          message: alert.message,
          metricValue: alert.metricValue,
          threshold: alert.threshold,
          triggeredAt: alert.triggeredAt,
        },
        rule: {
          id: rule.id,
          name: rule.name,
          metricType: rule.metricType,
        },
      };
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send webhook notification:', error);
    }
  }

  /**
   * Clean old entries from recent alerts cache
   */
  private cleanRecentAlertsCache(): void {
    const fiveMinutesAgo = Date.now() - 300000;
    
    for (const [key, timestamp] of this.recentAlerts.entries()) {
      if (timestamp.getTime() < fiveMinutesAgo) {
        this.recentAlerts.delete(key);
      }
    }
  }

  /**
   * Add or update an alert rule
   */
  async upsertAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertRule> {
    const query = `
      INSERT INTO alert_rules (
        name, metric_type, condition, threshold,
        evaluation_period, project_id, is_active,
        notification_channels, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (name, project_id) 
      DO UPDATE SET
        metric_type = $2,
        condition = $3,
        threshold = $4,
        evaluation_period = $5,
        is_active = $7,
        notification_channels = $8,
        updated_at = NOW()
      RETURNING *
    `;
    
    const values = [
      rule.name,
      rule.metricType,
      rule.condition,
      rule.threshold,
      rule.evaluationPeriod,
      rule.projectId || null,
      rule.isActive,
      rule.notificationChannels ? JSON.stringify(rule.notificationChannels) : null,
      rule.createdBy,
    ];
    
    const result = await this.pool.query(query, values);
    const savedRule = this.mapRowToAlertRule(result.rows[0]);
    
    // Update in-memory rules if active
    if (savedRule.isActive) {
      this.activeRules.set(savedRule.id, savedRule);
    } else {
      this.activeRules.delete(savedRule.id);
    }
    
    return savedRule;
  }

  /**
   * Delete an alert rule
   */
  async deleteAlertRule(ruleId: string): Promise<void> {
    await this.pool.query('DELETE FROM alert_rules WHERE id = $1', [ruleId]);
    this.activeRules.delete(ruleId);
  }

  /**
   * Get alert statistics
   */
  async getAlertStatistics(projectId?: string): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'active') as active_count,
        COUNT(*) FILTER (WHERE status = 'acknowledged') as acknowledged_count,
        COUNT(*) FILTER (WHERE status = 'resolved' AND resolved_at >= NOW() - INTERVAL '24 hours') as resolved_24h,
        COUNT(*) FILTER (WHERE severity = 'critical' AND status = 'active') as critical_active,
        COUNT(*) FILTER (WHERE severity = 'high' AND status = 'active') as high_active,
        COUNT(*) FILTER (WHERE triggered_at >= NOW() - INTERVAL '1 hour') as triggered_last_hour,
        AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - triggered_at))/60) as avg_resolution_time_minutes
      FROM alerts
      WHERE triggered_at >= NOW() - INTERVAL '7 days'
        ${projectId ? 'AND project_id = $1' : ''}
    `;
    
    const values = projectId ? [projectId] : [];
    const result = await this.pool.query(query, values);
    
    return {
      activeCount: parseInt(result.rows[0].active_count) || 0,
      acknowledgedCount: parseInt(result.rows[0].acknowledged_count) || 0,
      resolved24h: parseInt(result.rows[0].resolved_24h) || 0,
      criticalActive: parseInt(result.rows[0].critical_active) || 0,
      highActive: parseInt(result.rows[0].high_active) || 0,
      triggeredLastHour: parseInt(result.rows[0].triggered_last_hour) || 0,
      avgResolutionTimeMinutes: parseFloat(result.rows[0].avg_resolution_time_minutes) || 0,
    };
  }

  /**
   * Map database row to AlertRule
   */
  private mapRowToAlertRule(row: any): AlertRule {
    return {
      id: row.id,
      name: row.name,
      metricType: row.metric_type,
      condition: row.condition,
      threshold: parseFloat(row.threshold),
      evaluationPeriod: row.evaluation_period,
      projectId: row.project_id,
      isActive: row.is_active,
      notificationChannels: row.notification_channels 
        ? JSON.parse(row.notification_channels) 
        : undefined,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to Alert
   */
  private mapRowToAlert(row: any): Alert {
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