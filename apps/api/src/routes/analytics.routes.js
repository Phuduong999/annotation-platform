import { z } from 'zod';

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

export const analyticsRoutes = async (fastify, pool) => {
  // Mock service for now - replace with actual implementations
  const analyticsService = {
    getCurrentMetrics: async (params) => ({
      taskThroughput: 150,
      acceptanceRate: 85.5,
      activeUsers: 25,
      queueSize: 45,
    }),
    
    getTimeSeries: async (params) => ({
      metricType: params.metricType,
      data: Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - (24 - i) * 3600000),
        value: Math.random() * 100,
        count: Math.floor(Math.random() * 50),
      })),
      aggregation: params.aggregation || 'hour',
      projectId: params.projectId,
    }),
    
    getKPIs: async (params) => ({
      taskThroughput: {
        name: 'Task Throughput',
        value: 150,
        previousValue: 120,
        change: 30,
        changePercentage: 25,
        trend: 'up',
        target: 200,
        targetMet: false,
        period: params.period,
      },
      acceptanceRate: {
        name: 'Acceptance Rate',
        value: 85.5,
        previousValue: 82.3,
        change: 3.2,
        changePercentage: 3.9,
        trend: 'up',
        target: 90,
        targetMet: false,
        period: params.period,
      },
      reworkRate: {
        name: 'Rework Rate',
        value: 12.3,
        previousValue: 15.2,
        change: -2.9,
        changePercentage: -19.1,
        trend: 'down',
        target: 10,
        targetMet: false,
        period: params.period,
      },
      linkErrorRate: {
        name: 'Link Error Rate',
        value: 2.1,
        previousValue: 3.5,
        change: -1.4,
        changePercentage: -40,
        trend: 'down',
        target: 2,
        targetMet: false,
        period: params.period,
      },
      dislikeRate: {
        name: 'Dislike Rate',
        value: 5.2,
        previousValue: 6.1,
        change: -0.9,
        changePercentage: -14.8,
        trend: 'down',
        target: 5,
        targetMet: false,
        period: params.period,
      },
      interAnnotatorAgreement: {
        name: 'Inter-Annotator Agreement',
        value: 0.78,
        previousValue: 0.75,
        change: 0.03,
        changePercentage: 4,
        trend: 'up',
        target: 0.8,
        targetMet: false,
        period: params.period,
      },
      reviewThroughput: {
        name: 'Review Throughput',
        value: 45,
        previousValue: 38,
        change: 7,
        changePercentage: 18.4,
        trend: 'up',
        target: 50,
        targetMet: false,
        period: params.period,
      },
      averageCompletionTime: {
        name: 'Average Completion Time',
        value: 3.2,
        previousValue: 3.8,
        change: -0.6,
        changePercentage: -15.8,
        trend: 'down',
        target: 3,
        targetMet: false,
        period: params.period,
      },
      activeUsers: {
        name: 'Active Users',
        value: 25,
        previousValue: 22,
        change: 3,
        changePercentage: 13.6,
        trend: 'up',
        period: params.period,
      },
      queueSize: {
        name: 'Queue Size',
        value: 45,
        previousValue: 52,
        change: -7,
        changePercentage: -13.5,
        trend: 'down',
        period: params.period,
      },
    }),
    
    getLeaderboard: async (params) => 
      Array.from({ length: params.limit || 10 }, (_, i) => ({
        userId: `user-${i + 1}`,
        userName: `User ${i + 1}`,
        userEmail: `user${i + 1}@example.com`,
        value: Math.floor(Math.random() * 100) + 50,
        rank: i + 1,
        previousRank: i + 2,
        change: -1,
      })),
    
    getAlerts: async (params) => 
      Array.from({ length: 5 }, (_, i) => ({
        id: `alert-${i + 1}`,
        ruleId: `rule-${i + 1}`,
        ruleName: `Alert Rule ${i + 1}`,
        severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
        status: ['active', 'acknowledged', 'resolved'][Math.floor(Math.random() * 3)],
        message: `Metric threshold exceeded for ${['task throughput', 'acceptance rate', 'error rate'][i % 3]}`,
        metricValue: Math.random() * 100,
        threshold: 80,
        triggeredAt: new Date(Date.now() - Math.random() * 86400000),
      })),
    
    getProjectSummary: async (projectId) => ({
      projectId,
      projectName: 'Sample Project',
      overview: {
        totalTasks: 1250,
        completedTasks: 950,
        inProgressTasks: 200,
        totalReviews: 850,
        totalUsers: 25,
        averageCompletionTime: 3.2,
      },
      kpis: await analyticsService.getKPIs({ period: 'month' }),
      recentActivity: Array.from({ length: 10 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 3600000),
        activityType: 'task_completed',
        userId: `user-${i + 1}`,
        userName: `User ${i + 1}`,
        details: `Completed task #${1000 + i}`,
      })),
      topContributors: await analyticsService.getLeaderboard({ limit: 5 }),
      alerts: await analyticsService.getAlerts({ limit: 5 }),
      trends: {
        daily: [await analyticsService.getTimeSeries({ metricType: 'task_throughput', aggregation: 'day' })],
        weekly: [await analyticsService.getTimeSeries({ metricType: 'task_throughput', aggregation: 'week' })],
      },
    }),
  };

  // GET /api/analytics/metrics/current
  fastify.get('/api/analytics/metrics/current', async (request, reply) => {
    try {
      const { projectId } = request.query;
      
      const metrics = await analyticsService.getCurrentMetrics({
        projectId,
        userId: 'user-123', // TODO: Get from auth context
      });

      return reply.code(200).send({
        success: true,
        data: metrics,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch metrics',
      });
    }
  });

  // GET /api/analytics/time-series
  fastify.get('/api/analytics/time-series', async (request, reply) => {
    try {
      const query = TimeSeriesQuerySchema.parse(request.query);
      
      const data = await analyticsService.getTimeSeries({
        ...query,
        userId: 'user-123', // TODO: Get from auth context
      });

      return reply.code(200).send({
        success: true,
        data,
      });
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid query parameters',
          details: error.errors,
        });
      }
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch time series data',
      });
    }
  });

  // GET /api/analytics/kpis
  fastify.get('/api/analytics/kpis', async (request, reply) => {
    try {
      const query = KPIQuerySchema.parse(request.query);
      
      const kpis = await analyticsService.getKPIs({
        ...query,
        userId: 'user-123', // TODO: Get from auth context
      });

      return reply.code(200).send({
        success: true,
        data: kpis,
      });
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid query parameters',
          details: error.errors,
        });
      }
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch KPIs',
      });
    }
  });

  // GET /api/analytics/leaderboard
  fastify.get('/api/analytics/leaderboard', async (request, reply) => {
    try {
      const query = LeaderboardQuerySchema.parse(request.query);
      
      const leaderboard = await analyticsService.getLeaderboard({
        ...query,
        organizationId: 'org-123', // TODO: Get from auth context
      });

      return reply.code(200).send({
        success: true,
        data: leaderboard,
      });
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid query parameters',
          details: error.errors,
        });
      }
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch leaderboard',
      });
    }
  });

  // GET /api/analytics/alerts
  fastify.get('/api/analytics/alerts', async (request, reply) => {
    try {
      const { status, severity, limit = 50, offset = 0 } = request.query;
      
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
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch alerts',
      });
    }
  });

  // GET /api/analytics/project/:projectId/summary
  fastify.get('/api/analytics/project/:projectId/summary', async (request, reply) => {
    try {
      const { projectId } = request.params;
      
      const summary = await analyticsService.getProjectSummary(
        projectId,
        'user-123' // TODO: Get from auth context
      );

      return reply.code(200).send({
        success: true,
        data: summary,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch project summary',
      });
    }
  });
};