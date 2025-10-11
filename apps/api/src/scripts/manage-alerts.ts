#!/usr/bin/env node
import { Command } from 'commander';
import { AlertService } from '../services/alert.service.js';
import { MetricType } from '../types/analytics.js';
import { getPool } from '../config/database.js';

const program = new Command();
const alertService = AlertService.getInstance();

program
  .name('alert-manager')
  .description('CLI to manage alert rules and monitoring')
  .version('1.0.0');

// Add alert rule command
program
  .command('add-rule')
  .description('Add a new alert rule')
  .requiredOption('-n, --name <name>', 'Rule name')
  .requiredOption('-m, --metric <metric>', 'Metric type')
  .requiredOption('-c, --condition <condition>', 'Condition (greater_than, less_than, equals)')
  .requiredOption('-t, --threshold <threshold>', 'Threshold value', parseFloat)
  .option('-p, --project <projectId>', 'Project ID')
  .option('-e, --evaluation <minutes>', 'Evaluation period in minutes', parseInt, 5)
  .option('--channels <channels...>', 'Notification channels (email, slack, webhook, database)')
  .option('--inactive', 'Create rule as inactive')
  .action(async (options) => {
    try {
      const rule = await alertService.upsertAlertRule({
        name: options.name,
        metricType: options.metric as MetricType,
        condition: options.condition,
        threshold: options.threshold,
        evaluationPeriod: options.evaluation,
        projectId: options.project,
        isActive: !options.inactive,
        notificationChannels: options.channels,
        createdBy: 'cli-user',
      });
      
      console.log('✅ Alert rule created:');
      console.log(JSON.stringify(rule, null, 2));
    } catch (error) {
      console.error('❌ Failed to create alert rule:', error);
      process.exit(1);
    }
  });

// List rules command
program
  .command('list-rules')
  .description('List all alert rules')
  .option('-a, --active', 'Show only active rules')
  .option('-p, --project <projectId>', 'Filter by project ID')
  .action(async (options) => {
    try {
      const pool = getPool();
      let query = 'SELECT * FROM alert_rules WHERE 1=1';
      const params = [];
      
      if (options.active) {
        query += ' AND is_active = true';
      }
      
      if (options.project) {
        params.push(options.project);
        query += ` AND project_id = $${params.length}`;
      }
      
      query += ' ORDER BY created_at DESC';
      
      const result = await pool.query(query, params);
      
      console.log(`Found ${result.rows.length} alert rules:\n`);
      result.rows.forEach(rule => {
        console.log(`ID: ${rule.id}`);
        console.log(`Name: ${rule.name}`);
        console.log(`Metric: ${rule.metric_type}`);
        console.log(`Condition: ${rule.condition} ${rule.threshold}`);
        console.log(`Active: ${rule.is_active}`);
        console.log(`---`);
      });
    } catch (error) {
      console.error('❌ Failed to list alert rules:', error);
      process.exit(1);
    }
  });

// Delete rule command
program
  .command('delete-rule <ruleId>')
  .description('Delete an alert rule')
  .action(async (ruleId) => {
    try {
      await alertService.deleteAlertRule(ruleId);
      console.log(`✅ Alert rule ${ruleId} deleted`);
    } catch (error) {
      console.error('❌ Failed to delete alert rule:', error);
      process.exit(1);
    }
  });

// View alerts command
program
  .command('view-alerts')
  .description('View current alerts')
  .option('-s, --status <status>', 'Filter by status (active, acknowledged, resolved)')
  .option('-v, --severity <severity>', 'Filter by severity (low, medium, high, critical)')
  .option('-p, --project <projectId>', 'Filter by project ID')
  .option('-l, --limit <limit>', 'Limit results', parseInt, 20)
  .action(async (options) => {
    try {
      const pool = getPool();
      let query = 'SELECT * FROM alerts WHERE 1=1';
      const params = [];
      
      if (options.status) {
        params.push(options.status);
        query += ` AND status = $${params.length}`;
      }
      
      if (options.severity) {
        params.push(options.severity);
        query += ` AND severity = $${params.length}`;
      }
      
      if (options.project) {
        params.push(options.project);
        query += ` AND project_id = $${params.length}`;
      }
      
      query += ' ORDER BY triggered_at DESC';
      
      if (options.limit) {
        params.push(options.limit);
        query += ` LIMIT $${params.length}`;
      }
      
      const result = await pool.query(query, params);
      
      console.log(`Found ${result.rows.length} alerts:\n`);
      result.rows.forEach(alert => {
        const statusIcon = alert.status === 'active' ? '🔴' : 
                          alert.status === 'acknowledged' ? '🟡' : '🟢';
        const severityIcon = alert.severity === 'critical' ? '🚨' :
                            alert.severity === 'high' ? '⚠️' :
                            alert.severity === 'medium' ? '⚡' : 'ℹ️';
        
        console.log(`${statusIcon} ${severityIcon} [${alert.severity.toUpperCase()}] ${alert.message}`);
        console.log(`   ID: ${alert.id}`);
        console.log(`   Status: ${alert.status}`);
        console.log(`   Triggered: ${alert.triggered_at}`);
        console.log(`---`);
      });
    } catch (error) {
      console.error('❌ Failed to view alerts:', error);
      process.exit(1);
    }
  });

// Get statistics command
program
  .command('stats')
  .description('Get alert statistics')
  .option('-p, --project <projectId>', 'Filter by project ID')
  .action(async (options) => {
    try {
      const stats = await alertService.getAlertStatistics(options.project);
      
      console.log('📊 Alert Statistics:\n');
      console.log(`Active Alerts: ${stats.activeCount}`);
      console.log(`Acknowledged: ${stats.acknowledgedCount}`);
      console.log(`Resolved (24h): ${stats.resolved24h}`);
      console.log(`Critical Active: ${stats.criticalActive}`);
      console.log(`High Priority Active: ${stats.highActive}`);
      console.log(`Triggered Last Hour: ${stats.triggeredLastHour}`);
      console.log(`Avg Resolution Time: ${stats.avgResolutionTimeMinutes.toFixed(2)} minutes`);
    } catch (error) {
      console.error('❌ Failed to get statistics:', error);
      process.exit(1);
    }
  });

// Start monitoring command
program
  .command('start-monitoring')
  .description('Start the alert monitoring engine')
  .option('-i, --interval <seconds>', 'Evaluation interval in seconds', parseInt, 60)
  .action(async (options) => {
    try {
      console.log('🚀 Starting alert monitoring engine...');
      await alertService.start(options.interval * 1000);
      
      // Keep the process running
      process.on('SIGINT', () => {
        console.log('\n⏹️  Stopping alert monitoring...');
        alertService.stop();
        process.exit(0);
      });
      
      console.log('✅ Alert monitoring is running. Press Ctrl+C to stop.');
    } catch (error) {
      console.error('❌ Failed to start monitoring:', error);
      process.exit(1);
    }
  });

// Initialize default alert rules command
program
  .command('init-defaults')
  .description('Initialize default alert rules')
  .action(async () => {
    try {
      console.log('📝 Creating default alert rules...\n');
      
      const defaultRules = [
        {
          name: 'High Error Rate',
          metricType: MetricType.ERROR_RATE,
          condition: 'greater_than' as const,
          threshold: 5,
          evaluationPeriod: 5,
          isActive: true,
          notificationChannels: ['database', 'webhook'],
          createdBy: 'system',
        },
        {
          name: 'Low Acceptance Rate',
          metricType: MetricType.ACCEPTANCE_RATE,
          condition: 'less_than' as const,
          threshold: 70,
          evaluationPeriod: 10,
          isActive: true,
          notificationChannels: ['database', 'email'],
          createdBy: 'system',
        },
        {
          name: 'High Rework Rate',
          metricType: MetricType.REWORK_RATE,
          condition: 'greater_than' as const,
          threshold: 20,
          evaluationPeriod: 10,
          isActive: true,
          notificationChannels: ['database'],
          createdBy: 'system',
        },
        {
          name: 'Large Queue Size',
          metricType: MetricType.QUEUE_SIZE,
          condition: 'greater_than' as const,
          threshold: 100,
          evaluationPeriod: 5,
          isActive: true,
          notificationChannels: ['database', 'slack'],
          createdBy: 'system',
        },
        {
          name: 'Slow API Response',
          metricType: MetricType.API_RESPONSE_TIME,
          condition: 'greater_than' as const,
          threshold: 1000, // milliseconds
          evaluationPeriod: 5,
          isActive: true,
          notificationChannels: ['database', 'webhook'],
          createdBy: 'system',
        },
        {
          name: 'Low Inter-Annotator Agreement',
          metricType: MetricType.INTER_ANNOTATOR_AGREEMENT,
          condition: 'less_than' as const,
          threshold: 0.6,
          evaluationPeriod: 30,
          isActive: true,
          notificationChannels: ['database', 'email'],
          createdBy: 'system',
        },
      ];
      
      for (const rule of defaultRules) {
        try {
          const created = await alertService.upsertAlertRule(rule);
          console.log(`✅ Created rule: ${created.name}`);
        } catch (error) {
          console.error(`❌ Failed to create rule ${rule.name}:`, error);
        }
      }
      
      console.log('\n✅ Default alert rules initialized');
    } catch (error) {
      console.error('❌ Failed to initialize default rules:', error);
      process.exit(1);
    }
  });

program.parse();