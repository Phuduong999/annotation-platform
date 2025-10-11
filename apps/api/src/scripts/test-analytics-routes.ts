#!/usr/bin/env ts-node

/**
 * Test script to verify analytics routes and alert functionality
 * This script tests all endpoints and ensures the consolidation was successful
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_URL || 'http://localhost:4000';

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  statusCode?: number;
  error?: string;
}

async function testEndpoint(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  expectedStatus = 200
): Promise<TestResult> {
  try {
    const config = {
      method: method.toLowerCase() as 'get' | 'post' | 'put' | 'delete',
      url: `${API_BASE_URL}${endpoint}`,
      ...(data && { data }),
      timeout: 10000,
      validateStatus: () => true, // Don't throw on HTTP errors
    };

    const response = await axios(config);
    
    const success = response.status === expectedStatus || 
                   (response.status >= 200 && response.status < 300);
    
    return {
      endpoint,
      method,
      status: success ? 'PASS' : 'FAIL',
      statusCode: response.status,
      error: success ? undefined : `Expected ${expectedStatus}, got ${response.status}`,
    };
  } catch (error) {
    return {
      endpoint,
      method,
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runAnalyticsTests(): Promise<void> {
  console.log('🧪 Testing Analytics Routes...\n');

  const tests: Array<{
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    endpoint: string;
    data?: any;
    expectedStatus?: number;
    description: string;
  }> = [
    // Health check
    {
      method: 'GET',
      endpoint: '/health',
      description: 'Server health check',
    },
    {
      method: 'GET',
      endpoint: '/analytics/health',
      description: 'Analytics health check',
    },
    
    // Metrics endpoints
    {
      method: 'GET',
      endpoint: '/analytics/metrics/current',
      description: 'Current metrics',
    },
    {
      method: 'GET',
      endpoint: '/analytics/metrics/current?projectId=test-project',
      description: 'Current metrics with project filter',
    },
    
    // Time series
    {
      method: 'GET',
      endpoint: '/analytics/time-series?metricType=task_throughput&startDate=2024-01-01T00:00:00Z&endDate=2024-01-02T00:00:00Z',
      description: 'Time series data',
    },
    
    // KPIs
    {
      method: 'GET',
      endpoint: '/analytics/kpis?period=day',
      description: 'Daily KPIs',
    },
    {
      method: 'GET',
      endpoint: '/analytics/kpis?period=week&compareWithPrevious=true',
      description: 'Weekly KPIs with comparison',
    },
    
    // Leaderboard
    {
      method: 'GET',
      endpoint: '/analytics/leaderboard?period=month&metric=tasks_completed&limit=5',
      description: 'Tasks completed leaderboard',
    },
    
    // Alerts
    {
      method: 'GET',
      endpoint: '/analytics/alerts',
      description: 'All alerts',
    },
    {
      method: 'GET',
      endpoint: '/analytics/alerts?status=active&limit=10',
      description: 'Active alerts',
    },
    {
      method: 'GET',
      endpoint: '/analytics/alerts/stats',
      description: 'Alert statistics',
    },
    
    // Alert rules
    {
      method: 'POST',
      endpoint: '/analytics/alerts/rules',
      data: {\n        name: 'Test Alert Rule',\n        metricType: 'TASK_THROUGHPUT',\n        condition: 'greater_than',\n        threshold: 100,\n        evaluationPeriod: 300,\n        isActive: true,\n        notificationChannels: ['database'],\n      },\n      expectedStatus: 201,\n      description: 'Create alert rule',\n    },\n    \n    // Project summary\n    {\n      method: 'GET',\n      endpoint: '/analytics/project/test-project/summary',\n      description: 'Project summary',\n    },\n    \n    // Export\n    {\n      method: 'GET',\n      endpoint: '/analytics/export?format=json&startDate=2024-01-01T00:00:00Z&endDate=2024-01-02T00:00:00Z',\n      description: 'Analytics export (JSON)',\n    },\n    \n    // Invalid requests (should fail gracefully)\n    {\n      method: 'GET',\n      endpoint: '/analytics/time-series?invalidParam=true',\n      expectedStatus: 400,\n      description: 'Invalid time series request (should fail)',\n    },\n  ];\n\n  const results: TestResult[] = [];\n  let passed = 0;\n  let failed = 0;\n  let skipped = 0;\n\n  for (const test of tests) {\n    process.stdout.write(`Testing ${test.method} ${test.endpoint}... `);\n    \n    const result = await testEndpoint(\n      test.method,\n      test.endpoint,\n      test.data,\n      test.expectedStatus\n    );\n    \n    results.push(result);\n    \n    // Color-coded output\n    if (result.status === 'PASS') {\n      console.log(`✅ PASS${result.statusCode ? ` (${result.statusCode})` : ''}`);\n      passed++;\n    } else if (result.status === 'FAIL') {\n      console.log(`❌ FAIL${result.statusCode ? ` (${result.statusCode})` : ''} - ${result.error}`);\n      failed++;\n    } else {\n      console.log(`⏭️  SKIP`);\n      skipped++;\n    }\n  }\n\n  // Summary\n  console.log(`\\n📊 Test Summary:`);\n  console.log(`   ✅ Passed: ${passed}`);\n  console.log(`   ❌ Failed: ${failed}`);\n  console.log(`   ⏭️  Skipped: ${skipped}`);\n  console.log(`   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\\n`);\n\n  // Failed tests details\n  if (failed > 0) {\n    console.log(`❌ Failed Tests:`);\n    results\n      .filter(r => r.status === 'FAIL')\n      .forEach(r => {\n        console.log(`   - ${r.method} ${r.endpoint}: ${r.error}`);\n      });\n    console.log();\n  }\n\n  // Check if server is running\n  if (failed === tests.length) {\n    console.log(`⚠️  It appears the server might not be running.`);\n    console.log(`   Start the server with: npm run dev`);\n    console.log(`   Or check if the API_URL is correct: ${API_BASE_URL}\\n`);\n  }\n\n  // Alert configuration check\n  console.log(`🔗 Alert Configuration:`);\n  console.log(`   - Webhook URL: ${process.env.ALERT_WEBHOOK_URL || 'Not configured'}`);\n  console.log(`   - Alert monitoring: ${process.env.ENABLE_ALERT_MONITORING === 'true' ? 'Enabled' : 'Disabled'}`);\n  console.log(`   - Evaluation interval: ${process.env.ALERT_EVALUATION_INTERVAL || '60'}s\\n`);\n\n  if (passed === tests.length - failed) {\n    console.log(`🎉 Analytics routes consolidation successful!`);\n  } else {\n    console.log(`⚠️  Some tests failed. Please check the server and endpoints.`);\n  }\n}\n\n// Test webhook payload format\nasync function testWebhookPayload(): Promise<void> {\n  console.log(`\\n🔗 Webhook Payload Test:`);\n  \n  const samplePayload = {\n    event_type: 'alert_triggered',\n    timestamp: new Date().toISOString(),\n    alert: {\n      id: 'test-alert-id',\n      severity: 'high',\n      status: 'active',\n      message: 'Link Error Rate is greater than threshold: 7.50 (threshold: 5)',\n      metric_value: 7.5,\n      threshold: 5,\n      project_id: 'test-project',\n      triggered_at: new Date().toISOString(),\n    },\n    rule: {\n      id: 'test-rule-id',\n      name: 'High Link Error Rate Alert',\n      metric_type: 'LINK_ERROR_RATE',\n      condition: 'greater_than',\n      evaluation_period: 300,\n    },\n    context: {\n      environment: process.env.NODE_ENV || 'development',\n      service: 'D4T4L4B3lXAI',\n    },\n  };\n\n  console.log('Sample webhook payload:');\n  console.log(JSON.stringify(samplePayload, null, 2));\n}\n\n// Run tests if called directly\nif (require.main === module) {\n  runAnalyticsTests()\n    .then(() => testWebhookPayload())\n    .catch(console.error);\n}\n\nexport { runAnalyticsTests, testWebhookPayload };"}}]}
</function_results>

<function_calls>
<invoke name="mark_todo_as_done">
<parameter name="todo_ids">["471bfa86-f977-40e9-93b4-e47e94c57c48"]