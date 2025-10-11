import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { z } from 'zod';
import { AnalyticsService } from '../services/analytics.service';
import { AlertService } from '../services/alert.service';
import { MetricType } from '../types/analytics';

// Schema validators
const TimeSeriesQuerySchema = z.object({
  metricType: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  aggregation: z.string().optional(),
  projectId: z.string().optional(),
});

const KPIQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'quarter', 'year']),
  projectId: z.string().optional(),
  compareWithPrevious: z.coerce.boolean().optional(),
});

const LeaderboardQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'all_time']),
  metric: z.enum(['tasks_completed', 'acceptance_rate', 'review_throughput', 'quality_score']),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  projectId: z.string().optional(),
});

const AlertRuleSchema = z.object({
  name: z.string(),
  metricType: z.nativeEnum(MetricType),
  condition: z.enum(['>', '<', '>=', '<=', '=', '!=']), // Match database check constraint
  threshold: z.number(),
  evaluationPeriod: z.number().min(60).max(3600), // 1 minute to 1 hour
  projectId: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  notificationChannels: z.array(z.string()).optional(),
});

export async function analyticsRoutes(fastify: FastifyInstance, pool: Pool) {
  const analyticsService = new AnalyticsService();
  const alertService = AlertService.getInstance();

  // GET /analytics/metrics/current
  fastify.get('/analytics/metrics/current', async (request, reply) => {
    try {
      const { projectId } = request.query as { projectId?: string };
      
      const metrics = await analyticsService.getCurrentMetrics({
        projectId,
        userId: 'user-123', // TODO: Get from auth context
      });

      return reply.code(200).send({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch metrics',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /analytics/time-series
  fastify.get('/analytics/time-series', async (request, reply) => {
    try {
      const query = TimeSeriesQuerySchema.parse(request.query);
      
      const data = await analyticsService.getTimeSeries({
        ...query,
        userId: 'user-123', // TODO: Get from auth context
      });

      return reply.code(200).send({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid query parameters',
          details: error.errors,
          timestamp: new Date().toISOString(),
        });
      }
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch time series data',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /analytics/kpis
  fastify.get('/analytics/kpis', async (request, reply) => {
    try {
      const query = KPIQuerySchema.parse(request.query);
      
      const kpis = await analyticsService.getKPIs({
        ...query,
        userId: 'user-123', // TODO: Get from auth context
      });

      return reply.code(200).send({
        success: true,
        data: kpis,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid query parameters',
          details: error.errors,
          timestamp: new Date().toISOString(),
        });
      }
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch KPIs',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /analytics/leaderboard
  fastify.get('/analytics/leaderboard', async (request, reply) => {
    try {
      const query = LeaderboardQuerySchema.parse(request.query);
      
      const leaderboard = await analyticsService.getLeaderboard({
        ...query,
        organizationId: 'org-123', // TODO: Get from auth context
      });

      return reply.code(200).send({
        success: true,
        data: leaderboard,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid query parameters',
          details: error.errors,
          timestamp: new Date().toISOString(),
        });
      }
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch leaderboard',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /analytics/alerts
  fastify.get('/analytics/alerts', async (request, reply) => {
    try {
      const { status, severity, limit = 50, offset = 0 } = request.query as {
        status?: string;
        severity?: string;
        limit?: number;
        offset?: number;
      };
      
      const alerts = await analyticsService.getAlerts({
        userId: 'user-123', // TODO: Get from auth context
        status,
        severity,
        limit: Number(limit),
        offset: Number(offset),
      });

      return reply.code(200).send({
        success: true,
        data: alerts,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch alerts',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // POST /analytics/alerts/rules
  fastify.post('/analytics/alerts/rules', async (request, reply) => {
    try {
      const ruleData = AlertRuleSchema.parse(request.body);
      
      const rule = await alertService.upsertAlertRule({
        ...ruleData,
        createdBy: 'user-123', // TODO: Get from auth context
      });

      return reply.code(201).send({
        success: true,
        data: rule,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid alert rule data',
          details: error.errors,
          timestamp: new Date().toISOString(),
        });
      }
      return reply.code(500).send({
        success: false,
        error: 'Failed to create alert rule',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // DELETE /analytics/alerts/rules/:id
  fastify.delete('/analytics/alerts/rules/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      await alertService.deleteAlertRule(id);

      return reply.code(204).send();
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to delete alert rule',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // PUT /analytics/alerts/:id/acknowledge
  fastify.put('/analytics/alerts/:id/acknowledge', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      const alert = await analyticsService.acknowledgeAlert(id, 'user-123'); // TODO: Get from auth

      return reply.code(200).send({
        success: true,
        data: alert,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to acknowledge alert',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /analytics/alerts/stats
  fastify.get('/analytics/alerts/stats', async (request, reply) => {
    try {
      const { projectId } = request.query as { projectId?: string };
      
      const stats = await alertService.getAlertStatistics(projectId);

      return reply.code(200).send({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch alert statistics',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /analytics/project/:projectId/summary
  fastify.get('/analytics/project/:projectId/summary', async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      
      const summary = await analyticsService.getProjectSummary(
        projectId,
        'user-123' // TODO: Get from auth context
      );

      return reply.code(200).send({
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch project summary',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /analytics/export
  fastify.get('/analytics/export', async (request, reply) => {
    try {
      const {
        format = 'json',
        startDate,
        endDate,
        projectId
      } = request.query as {
        format?: 'json' | 'csv';
        startDate: string;
        endDate: string;
        projectId?: string;
      };
      
      if (!startDate || !endDate) {
        return reply.code(400).send({
          success: false,
          error: 'startDate and endDate are required',
          timestamp: new Date().toISOString(),
        });
      }

      const exportData = await analyticsService.exportAnalytics({
        format,
        startDate,
        endDate,
        projectId,
        userId: 'user-123', // TODO: Get from auth context
      });

      const contentType = format === 'csv' ? 'text/csv' : 'application/json';
      const filename = `analytics-export-${new Date().toISOString().split('T')[0]}.${format}`;

      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .code(200)
        .send(exportData);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to export analytics data',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /analytics/health
  fastify.get('/analytics/health', async (request, reply) => {
    return reply.code(200).send({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  // Initialize default alert rules for link_error_rate and acceptance_rate
  await initializeDefaultAlertRules(alertService);
}

/**
 * Initialize default alert rules for critical metrics
 */
async function initializeDefaultAlertRules(alertService: AlertService): Promise<void> {
  const defaultRules = [
    {
      name: 'High Link Error Rate Alert',
      metricType: MetricType.LINK_ERROR_RATE,
      condition: '>' as const, // Changed from 'greater_than' to match DB constraint
      threshold: 5, // 5%
      evaluationPeriod: 300, // 5 minutes
      isActive: true,
      notificationChannels: ['webhook', 'database'],
      createdBy: 'system',
    },
    {
      name: 'Low Acceptance Rate Alert',
      metricType: MetricType.ACCEPTANCE_RATE,
      condition: '<' as const, // Changed from 'less_than' to match DB constraint
      threshold: 75, // 75%
      evaluationPeriod: 600, // 10 minutes
      isActive: true,
      notificationChannels: ['webhook', 'database'],
      createdBy: 'system',
    },
  ];

  for (const rule of defaultRules) {
    try {
      await alertService.upsertAlertRule(rule);
      console.log(`Initialized default alert rule: ${rule.name}`);
    } catch (error) {
      console.error(`Failed to initialize alert rule ${rule.name}:`, error);
    }
  }
}
