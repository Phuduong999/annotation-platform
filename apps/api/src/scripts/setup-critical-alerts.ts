#!/usr/bin/env ts-node

/**
 * Setup critical alert rules for link error rate and acceptance rate
 * This script creates alert rules that will trigger webhooks when metrics exceed thresholds
 */

import { AlertService } from '../services/alert.service';
import { MetricType } from '../types/analytics';

async function setupCriticalAlerts() {
  console.log('Setting up critical alert rules...');
  
  const alertService = AlertService.getInstance();
  
  const criticalRules = [
    {
      name: 'Critical Link Error Rate Alert',
      metricType: MetricType.LINK_ERROR_RATE,
      condition: 'greater_than' as const,
      threshold: 10, // 10% - Critical level
      evaluationPeriod: 180, // 3 minutes - Fast response
      isActive: true,
      notificationChannels: ['webhook', 'database'],
      createdBy: 'system',
    },
    {
      name: 'High Link Error Rate Alert', 
      metricType: MetricType.LINK_ERROR_RATE,
      condition: 'greater_than' as const,
      threshold: 5, // 5% - Warning level
      evaluationPeriod: 300, // 5 minutes
      isActive: true,
      notificationChannels: ['webhook', 'database'],
      createdBy: 'system',
    },
    {
      name: 'Critical Low Acceptance Rate Alert',
      metricType: MetricType.ACCEPTANCE_RATE,
      condition: 'less_than' as const,
      threshold: 50, // 50% - Critical level
      evaluationPeriod: 300, // 5 minutes
      isActive: true,
      notificationChannels: ['webhook', 'database'],
      createdBy: 'system',
    },
    {
      name: 'Low Acceptance Rate Alert',
      metricType: MetricType.ACCEPTANCE_RATE,
      condition: 'less_than' as const,
      threshold: 75, // 75% - Warning level
      evaluationPeriod: 600, // 10 minutes
      isActive: true,
      notificationChannels: ['webhook', 'database'],
      createdBy: 'system',
    },
    {
      name: 'High Task Queue Size Alert',
      metricType: MetricType.QUEUE_SIZE,
      condition: 'greater_than' as const,
      threshold: 100, // 100 tasks
      evaluationPeriod: 900, // 15 minutes
      isActive: true,
      notificationChannels: ['webhook', 'database'],
      createdBy: 'system',
    },
  ];

  let created = 0;
  let updated = 0;

  for (const rule of criticalRules) {
    try {
      const result = await alertService.upsertAlertRule(rule);
      
      if (result.createdAt === result.updatedAt) {
        created++;
        console.log(`✅ Created alert rule: ${rule.name}`);
      } else {
        updated++;
        console.log(`📝 Updated alert rule: ${rule.name}`);
      }
      
      console.log(`   - Metric: ${rule.metricType}`);
      console.log(`   - Condition: ${rule.condition} ${rule.threshold}`);
      console.log(`   - Evaluation period: ${rule.evaluationPeriod}s`);
      console.log(`   - Channels: ${rule.notificationChannels?.join(', ')}`);
      console.log();
    } catch (error) {
      console.error(`❌ Failed to setup alert rule '${rule.name}':`, error);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   - Created: ${created} new rules`);
  console.log(`   - Updated: ${updated} existing rules`);
  console.log(`   - Total active rules: ${criticalRules.length}`);
  
  // Show webhook configuration
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  console.log(`\n🔗 Webhook Configuration:`);
  console.log(`   - URL: ${webhookUrl || 'Not configured'}`);
  
  if (!webhookUrl) {
    console.log('\n⚠️  WARNING: No webhook URL configured!');
    console.log('   Set ALERT_WEBHOOK_URL environment variable to receive webhook notifications.');
    console.log('   Example: ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL');
  }

  console.log('\n🚀 Critical alert rules setup complete!');
}

// Run the setup if this script is called directly
if (require.main === module) {
  setupCriticalAlerts().catch(console.error);
}

export { setupCriticalAlerts };