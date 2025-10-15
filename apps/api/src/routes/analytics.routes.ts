import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';

export async function analyticsRoutes(fastify: FastifyInstance, pool: Pool) {
  
  // GET /analytics/overview - Overall statistics
  fastify.get('/analytics/overview', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Task status distribution
      const statusStats = await pool.query(`
        SELECT 
          status,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
        FROM tasks
        GROUP BY status
        ORDER BY count DESC
      `);

      // Scan type distribution
      const typeStats = await pool.query(`
        SELECT 
          scan_type as type,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
        FROM tasks
        WHERE scan_type IS NOT NULL
        GROUP BY scan_type
        ORDER BY count DESC
      `);

      // Completion rate
      const completionRate = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress')) as in_progress,
          COUNT(*) as total,
          ROUND(COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / NULLIF(COUNT(*), 0), 2) as completion_percentage
        FROM tasks
      `);

      // Average task duration
      const durationStats = await pool.query(`
        SELECT 
          ROUND(AVG(duration_ms) / 1000.0, 2) as avg_duration_seconds,
          ROUND(MIN(duration_ms) / 1000.0, 2) as min_duration_seconds,
          ROUND(MAX(duration_ms) / 1000.0, 2) as max_duration_seconds
        FROM tasks
        WHERE duration_ms IS NOT NULL AND status = 'completed'
      `);

      return reply.code(200).send({
        success: true,
        data: {
          statusDistribution: statusStats.rows,
          typeDistribution: typeStats.rows,
          completionRate: completionRate.rows[0],
          durationStats: durationStats.rows[0],
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /analytics/annotations - Annotation analysis
  fastify.get('/analytics/annotations', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Classification distribution
      const classificationStats = await pool.query(`
        SELECT 
          scan_type as classification,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
        FROM labels_final
        WHERE scan_type IS NOT NULL
        GROUP BY scan_type
        ORDER BY count DESC
      `);

      // Result return distribution
      const resultReturnStats = await pool.query(`
        SELECT 
          result_return,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
        FROM labels_final
        WHERE result_return IS NOT NULL
        GROUP BY result_return
        ORDER BY count DESC
      `);

      // Feedback correction distribution (multiple values per task)
      const feedbackCorrectionStats = await pool.query(`
        SELECT 
          UNNEST(feedback_correction) as correction_type,
          COUNT(*) as count
        FROM labels_final
        WHERE feedback_correction IS NOT NULL AND array_length(feedback_correction, 1) > 0
        GROUP BY correction_type
        ORDER BY count DESC
      `);

      // Most active annotators
      const annotatorStats = await pool.query(`
        SELECT 
          created_by as annotator,
          COUNT(*) as annotations_count,
          COUNT(DISTINCT DATE(created_at)) as active_days,
          MIN(created_at) as first_annotation,
          MAX(created_at) as last_annotation
        FROM labels_final
        WHERE created_by IS NOT NULL
        GROUP BY created_by
        ORDER BY annotations_count DESC
        LIMIT 10
      `);

      return reply.code(200).send({
        success: true,
        data: {
          classificationDistribution: classificationStats.rows,
          resultReturnDistribution: resultReturnStats.rows,
          feedbackCorrectionDistribution: feedbackCorrectionStats.rows,
          topAnnotators: annotatorStats.rows,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /analytics/feedback - End-user feedback analysis
  fastify.get('/analytics/feedback', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Reaction distribution
      const reactionStats = await pool.query(`
        SELECT 
          metadata->>'reaction' as reaction,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
        FROM feedback_events
        WHERE metadata->>'reaction' IS NOT NULL
        GROUP BY metadata->>'reaction'
        ORDER BY count DESC
      `);

      // Category distribution
      const categoryStats = await pool.query(`
        SELECT 
          metadata->>'category' as category,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
        FROM feedback_events
        WHERE metadata->>'category' IS NOT NULL
        GROUP BY metadata->>'category'
        ORDER BY count DESC
      `);

      // Tasks with dislike by scan type
      const dislikeByType = await pool.query(`
        SELECT 
          t.scan_type,
          COUNT(*) as dislike_count,
          COUNT(DISTINCT t.id) as total_tasks_with_feedback,
          ROUND(COUNT(*) * 100.0 / COUNT(DISTINCT t.id), 2) as dislike_rate
        FROM tasks t
        INNER JOIN feedback_events fe ON fe.task_id = t.id
        WHERE fe.metadata->>'reaction' = 'dislike'
        GROUP BY t.scan_type
        ORDER BY dislike_count DESC
      `);

      // Dislike reasons
      const dislikeReasons = await pool.query(`
        SELECT 
          metadata->>'category' as reason,
          COUNT(*) as count
        FROM feedback_events
        WHERE metadata->>'reaction' = 'dislike' AND metadata->>'category' IS NOT NULL
        GROUP BY metadata->>'category'
        ORDER BY count DESC
      `);

      return reply.code(200).send({
        success: true,
        data: {
          reactionDistribution: reactionStats.rows,
          categoryDistribution: categoryStats.rows,
          dislikeByType: dislikeByType.rows,
          dislikeReasons: dislikeReasons.rows,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /analytics/dropoff - Dropoff analysis
  fastify.get('/analytics/dropoff', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Funnel analysis
      const funnelStats = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'pending') as stage_1_pending,
          COUNT(*) FILTER (WHERE status = 'in_progress') as stage_2_started,
          COUNT(*) FILTER (WHERE status = 'completed') as stage_3_completed,
          COUNT(*) FILTER (WHERE status = 'skipped') as dropoff_skipped,
          COUNT(*) FILTER (WHERE status = 'failed') as dropoff_failed
        FROM tasks
      `);

      const funnel = funnelStats.rows[0];
      const total = parseInt(funnel.stage_1_pending) + parseInt(funnel.stage_2_started) + parseInt(funnel.stage_3_completed);
      
      // Calculate dropoff rates
      const dropoffAnalysis = {
        stage_1_pending: {
          count: parseInt(funnel.stage_1_pending),
          percentage: total > 0 ? parseFloat(((parseInt(funnel.stage_1_pending) / total) * 100).toFixed(2)) : 0,
        },
        stage_2_started: {
          count: parseInt(funnel.stage_2_started),
          percentage: total > 0 ? parseFloat(((parseInt(funnel.stage_2_started) / total) * 100).toFixed(2)) : 0,
        },
        stage_3_completed: {
          count: parseInt(funnel.stage_3_completed),
          percentage: total > 0 ? parseFloat(((parseInt(funnel.stage_3_completed) / total) * 100).toFixed(2)) : 0,
        },
        dropoff: {
          skipped: parseInt(funnel.dropoff_skipped),
          failed: parseInt(funnel.dropoff_failed),
          total: parseInt(funnel.dropoff_skipped) + parseInt(funnel.dropoff_failed),
        },
      };

      // Time-based dropoff (tasks started but not completed within 24h)
      const staleTasksStats = await pool.query(`
        SELECT 
          COUNT(*) as stale_count,
          ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - started_at)) / 3600), 2) as avg_hours_stale
        FROM tasks
        WHERE status = 'in_progress' 
        AND started_at < NOW() - INTERVAL '24 hours'
      `);

      return reply.code(200).send({
        success: true,
        data: {
          funnel: dropoffAnalysis,
          staleTasks: staleTasksStats.rows[0],
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /analytics/by-type - Analysis by scan type
  fastify.get('/analytics/by-type', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Dropoff rate by type
      const dropoffByType = await pool.query(`
        SELECT 
          scan_type,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'skipped') as skipped,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          COUNT(*) as total,
          ROUND(COUNT(*) FILTER (WHERE status IN ('skipped', 'failed')) * 100.0 / NULLIF(COUNT(*), 0), 2) as dropoff_rate
        FROM tasks
        WHERE scan_type IS NOT NULL
        GROUP BY scan_type
        ORDER BY dropoff_rate DESC NULLS LAST
      `);

      // Annotation tags frequency by type
      const tagsByType = await pool.query(`
        SELECT 
          t.scan_type,
          lf.scan_type as annotated_classification,
          lf.result_return,
          UNNEST(lf.feedback_correction) as feedback_tag,
          COUNT(*) as tag_count
        FROM tasks t
        INNER JOIN labels_final lf ON lf.task_id = t.id
        WHERE t.scan_type IS NOT NULL AND lf.feedback_correction IS NOT NULL
        GROUP BY t.scan_type, lf.scan_type, lf.result_return, feedback_tag
        ORDER BY t.scan_type, tag_count DESC
      `);

      // Classification match rate by original type
      const classificationMatch = await pool.query(`
        SELECT 
          t.scan_type as original_type,
          lf.scan_type as annotated_type,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY t.scan_type), 2) as percentage
        FROM tasks t
        INNER JOIN labels_final lf ON lf.task_id = t.id
        WHERE t.scan_type IS NOT NULL
        GROUP BY t.scan_type, lf.scan_type
        ORDER BY t.scan_type, count DESC
      `);

      return reply.code(200).send({
        success: true,
        data: {
          dropoffByType: dropoffByType.rows,
          tagsByType: tagsByType.rows,
          classificationMatch: classificationMatch.rows,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /analytics/user-behavior - User behavior analysis
  fastify.get('/analytics/user-behavior', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Users who viewed AI result but didn't provide feedback
      const exitWithoutFeedback = await pool.query(`
        SELECT 
          t.scan_type,
          COUNT(DISTINCT t.id) as tasks_without_feedback,
          COUNT(DISTINCT t.user_id) as unique_users,
          ROUND(COUNT(DISTINCT t.id) * 100.0 / NULLIF(
            (SELECT COUNT(*) FROM tasks WHERE raw_ai_output IS NOT NULL), 
          0), 2) as exit_rate
        FROM tasks t
        LEFT JOIN feedback_events fe ON fe.task_id = t.id
        WHERE t.raw_ai_output IS NOT NULL -- AI result was shown
        AND t.status = 'pending' -- User didn't take action
        AND fe.id IS NULL -- No feedback provided
        GROUP BY t.scan_type
        ORDER BY tasks_without_feedback DESC
      `);

      // Tasks with AI output but no user engagement
      const noEngagement = await pool.query(`
        SELECT 
          COUNT(*) as total_no_engagement,
          COUNT(DISTINCT user_id) as unique_users,
          ROUND(AVG(CAST(ai_confidence AS numeric)), 2) as avg_ai_confidence
        FROM tasks
        WHERE raw_ai_output IS NOT NULL
        AND status = 'pending'
        AND started_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM feedback_events fe WHERE fe.task_id = tasks.id
        )
      `);

      // Engagement funnel
      const engagementFunnel = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE raw_ai_output IS NOT NULL) as stage_1_ai_shown,
          COUNT(*) FILTER (WHERE started_at IS NOT NULL) as stage_2_task_started,
          COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as stage_3_task_completed,
          COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM feedback_events fe WHERE fe.task_id = tasks.id
          )) as stage_4_feedback_given
        FROM tasks
      `);

      const funnel = engagementFunnel.rows[0];
      const aiShown = parseInt(funnel.stage_1_ai_shown);
      
      const engagementMetrics = {
        ai_result_shown: aiShown,
        task_started: {
          count: parseInt(funnel.stage_2_task_started),
          rate: aiShown > 0 ? parseFloat(((parseInt(funnel.stage_2_task_started) / aiShown) * 100).toFixed(2)) : 0,
        },
        task_completed: {
          count: parseInt(funnel.stage_3_task_completed),
          rate: aiShown > 0 ? parseFloat(((parseInt(funnel.stage_3_task_completed) / aiShown) * 100).toFixed(2)) : 0,
        },
        feedback_given: {
          count: parseInt(funnel.stage_4_feedback_given),
          rate: aiShown > 0 ? parseFloat(((parseInt(funnel.stage_4_feedback_given) / aiShown) * 100).toFixed(2)) : 0,
        },
      };

      // Time spent before exit (for users who didn't complete)
      const timeAnalysis = await pool.query(`
        SELECT 
          t.scan_type,
          COUNT(*) as tasks,
          ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(started_at, created_at) - created_at))), 2) as avg_seconds_before_exit
        FROM tasks t
        WHERE status = 'pending'
        AND created_at < NOW() - INTERVAL '1 hour'
        GROUP BY t.scan_type
      `);

      return reply.code(200).send({
        success: true,
        data: {
          exitWithoutFeedback: exitWithoutFeedback.rows,
          noEngagement: noEngagement.rows[0],
          engagementMetrics,
          timeBeforeExit: timeAnalysis.rows,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /analytics/trends - Time-based trends
  fastify.get('/analytics/trends', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Daily completion trend (last 14 days)
      const dailyTrend = await pool.query(`
        SELECT 
          DATE(completed_at) as date,
          COUNT(*) as completed_count,
          ROUND(AVG(duration_ms) / 1000.0, 2) as avg_duration_seconds
        FROM tasks
        WHERE completed_at >= NOW() - INTERVAL '14 days' AND status = 'completed'
        GROUP BY DATE(completed_at)
        ORDER BY date DESC
      `);

      // Hourly distribution (when are tasks completed most)
      const hourlyDistribution = await pool.query(`
        SELECT 
          EXTRACT(HOUR FROM completed_at) as hour,
          COUNT(*) as count
        FROM tasks
        WHERE status = 'completed' AND completed_at IS NOT NULL
        GROUP BY EXTRACT(HOUR FROM completed_at)
        ORDER BY hour
      `);

      return reply.code(200).send({
        success: true,
        data: {
          dailyTrend: dailyTrend.rows,
          hourlyDistribution: hourlyDistribution.rows,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });
}
