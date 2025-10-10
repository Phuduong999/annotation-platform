-- Create metric type enum
CREATE TYPE metric_type AS ENUM (
  'throughput',
  'acceptance_rate',
  'rework_rate',
  'link_error_rate',
  'dislike_rate',
  'avg_latency',
  'completion_rate',
  'quality_score',
  'iaa_score'
);

-- Create alert severity enum
CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');

-- Create alert status enum
CREATE TYPE alert_status AS ENUM ('active', 'acknowledged', 'resolved', 'expired');

-- Create aggregation period enum
CREATE TYPE aggregation_period AS ENUM ('minute', 'hour', 'day', 'week', 'month');

-- Create metrics_history table for time-series data
CREATE TABLE IF NOT EXISTS metrics_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type metric_type NOT NULL,
  metric_value DECIMAL(10,4) NOT NULL,
  
  -- Dimensions
  user_id VARCHAR(255),
  team_id VARCHAR(255),
  category VARCHAR(100),
  task_type VARCHAR(50),
  
  -- Time
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  period aggregation_period NOT NULL DEFAULT 'hour',
  
  -- Additional data
  sample_count INTEGER DEFAULT 1,
  metadata JSONB,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create metrics_aggregations table for pre-calculated KPIs
CREATE TABLE IF NOT EXISTS metrics_aggregations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type metric_type NOT NULL,
  period aggregation_period NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  
  -- Aggregated values
  min_value DECIMAL(10,4),
  max_value DECIMAL(10,4),
  avg_value DECIMAL(10,4),
  sum_value DECIMAL(10,4),
  count_value INTEGER,
  p50_value DECIMAL(10,4),
  p95_value DECIMAL(10,4),
  p99_value DECIMAL(10,4),
  
  -- Dimensions
  user_id VARCHAR(255),
  team_id VARCHAR(255),
  category VARCHAR(100),
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(metric_type, period, period_start, user_id, team_id, category)
);

-- Create alert_rules table
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Rule configuration
  metric_type metric_type NOT NULL,
  condition VARCHAR(20) NOT NULL CHECK (condition IN ('>', '<', '>=', '<=', '=', '!=')),
  threshold DECIMAL(10,4) NOT NULL,
  
  -- Time window
  time_window_minutes INTEGER NOT NULL DEFAULT 5,
  consecutive_breaches INTEGER NOT NULL DEFAULT 1,
  
  -- Alert configuration
  severity alert_severity NOT NULL DEFAULT 'warning',
  is_enabled BOOLEAN DEFAULT TRUE,
  
  -- Notification
  notify_channels JSONB, -- e.g., ['email', 'slack', 'webhook']
  notify_recipients JSONB, -- List of recipients
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255) NOT NULL
);

-- Create alerts table for triggered alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES alert_rules(id),
  
  -- Alert details
  metric_type metric_type NOT NULL,
  metric_value DECIMAL(10,4) NOT NULL,
  threshold DECIMAL(10,4) NOT NULL,
  severity alert_severity NOT NULL,
  
  -- Status
  status alert_status NOT NULL DEFAULT 'active',
  
  -- Context
  message TEXT NOT NULL,
  context JSONB,
  
  -- Timeline
  triggered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  acknowledged_by VARCHAR(255),
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  expires_at TIMESTAMP,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create kpi_targets table for goal tracking
CREATE TABLE IF NOT EXISTS kpi_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type metric_type NOT NULL,
  target_value DECIMAL(10,4) NOT NULL,
  
  -- Period
  effective_from DATE NOT NULL,
  effective_to DATE,
  
  -- Dimensions
  team_id VARCHAR(255),
  category VARCHAR(100),
  
  -- Metadata
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255) NOT NULL,
  
  UNIQUE(metric_type, effective_from, team_id, category)
);

-- Create iaa_scores table for Inter-Annotator Agreement
CREATE TABLE IF NOT EXISTS iaa_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Annotators
  annotator1_id VARCHAR(255) NOT NULL,
  annotator2_id VARCHAR(255) NOT NULL,
  
  -- Scores
  kappa_score DECIMAL(5,4), -- Cohen's Kappa (-1 to 1)
  agreement_rate DECIMAL(5,4), -- Simple agreement (0 to 1)
  
  -- Sample info
  sample_size INTEGER NOT NULL,
  task_ids JSONB, -- Array of task IDs used
  
  -- Period
  calculation_date DATE NOT NULL,
  
  -- Category breakdown
  category_scores JSONB, -- Per-category kappa scores
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(annotator1_id, annotator2_id, calculation_date)
);

-- Indexes for metrics_history
CREATE INDEX idx_metrics_history_timestamp ON metrics_history(timestamp DESC);
CREATE INDEX idx_metrics_history_metric_type ON metrics_history(metric_type, timestamp DESC);
CREATE INDEX idx_metrics_history_user ON metrics_history(user_id, timestamp DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_metrics_history_team ON metrics_history(team_id, timestamp DESC) WHERE team_id IS NOT NULL;
CREATE INDEX idx_metrics_history_category ON metrics_history(category, timestamp DESC) WHERE category IS NOT NULL;

-- Indexes for metrics_aggregations
CREATE INDEX idx_metrics_agg_period ON metrics_aggregations(period, period_start DESC);
CREATE INDEX idx_metrics_agg_metric ON metrics_aggregations(metric_type, period_start DESC);
CREATE INDEX idx_metrics_agg_team ON metrics_aggregations(team_id, period_start DESC) WHERE team_id IS NOT NULL;

-- Indexes for alerts
CREATE INDEX idx_alerts_status ON alerts(status) WHERE status = 'active';
CREATE INDEX idx_alerts_rule ON alerts(rule_id);
CREATE INDEX idx_alerts_triggered ON alerts(triggered_at DESC);
CREATE INDEX idx_alerts_severity ON alerts(severity, status);

-- Indexes for iaa_scores
CREATE INDEX idx_iaa_scores_date ON iaa_scores(calculation_date DESC);
CREATE INDEX idx_iaa_annotators ON iaa_scores(annotator1_id, annotator2_id);

-- Function to calculate metrics
CREATE OR REPLACE FUNCTION calculate_hourly_metrics()
RETURNS void AS $$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
BEGIN
  start_time := date_trunc('hour', NOW() - INTERVAL '1 hour');
  end_time := date_trunc('hour', NOW());
  
  -- Calculate throughput
  INSERT INTO metrics_history (metric_type, metric_value, team_id, timestamp, period)
  SELECT 
    'throughput'::metric_type,
    COUNT(*)::DECIMAL,
    team_id,
    end_time,
    'hour'::aggregation_period
  FROM tasks
  WHERE created_at >= start_time AND created_at < end_time
  GROUP BY team_id;
  
  -- Calculate acceptance rate
  INSERT INTO metrics_history (metric_type, metric_value, team_id, timestamp, period)
  SELECT 
    'acceptance_rate'::metric_type,
    (COUNT(*) FILTER (WHERE action = 'accept') * 100.0 / NULLIF(COUNT(*), 0))::DECIMAL,
    t.team_id,
    end_time,
    'hour'::aggregation_period
  FROM reviews r
  JOIN tasks t ON r.task_id = t.id
  WHERE r.created_at >= start_time AND r.created_at < end_time
  GROUP BY t.team_id;
  
  -- Calculate rework rate
  INSERT INTO metrics_history (metric_type, metric_value, team_id, timestamp, period)
  SELECT 
    'rework_rate'::metric_type,
    (COUNT(*) FILTER (WHERE review_count > 0) * 100.0 / NULLIF(COUNT(*), 0))::DECIMAL,
    team_id,
    end_time,
    'hour'::aggregation_period
  FROM tasks
  WHERE created_at >= start_time AND created_at < end_time
  GROUP BY team_id;
  
  -- Calculate link error rate
  INSERT INTO metrics_history (metric_type, metric_value, timestamp, period)
  SELECT 
    'link_error_rate'::metric_type,
    (COUNT(*) FILTER (WHERE link_status != 'ok') * 100.0 / NULLIF(COUNT(*), 0))::DECIMAL,
    end_time,
    'hour'::aggregation_period
  FROM assets
  WHERE created_at >= start_time AND created_at < end_time;
  
  -- Calculate dislike rate
  INSERT INTO metrics_history (metric_type, metric_value, timestamp, period)
  SELECT 
    'dislike_rate'::metric_type,
    (COUNT(*) FILTER (WHERE reaction = 'dislike') * 100.0 / NULLIF(COUNT(*), 0))::DECIMAL,
    end_time,
    'hour'::aggregation_period
  FROM feedback_events
  WHERE created_at >= start_time AND created_at < end_time;
  
END;
$$ LANGUAGE plpgsql;

-- Function to check alert rules
CREATE OR REPLACE FUNCTION check_alert_rules()
RETURNS void AS $$
DECLARE
  rule RECORD;
  current_value DECIMAL;
  should_alert BOOLEAN;
BEGIN
  FOR rule IN SELECT * FROM alert_rules WHERE is_enabled = TRUE LOOP
    -- Get current metric value
    SELECT AVG(metric_value) INTO current_value
    FROM metrics_history
    WHERE metric_type = rule.metric_type
      AND timestamp >= NOW() - (rule.time_window_minutes || ' minutes')::INTERVAL;
    
    IF current_value IS NOT NULL THEN
      -- Check condition
      should_alert := CASE rule.condition
        WHEN '>' THEN current_value > rule.threshold
        WHEN '<' THEN current_value < rule.threshold
        WHEN '>=' THEN current_value >= rule.threshold
        WHEN '<=' THEN current_value <= rule.threshold
        WHEN '=' THEN current_value = rule.threshold
        WHEN '!=' THEN current_value != rule.threshold
      END;
      
      IF should_alert THEN
        -- Check if alert already exists
        IF NOT EXISTS (
          SELECT 1 FROM alerts 
          WHERE rule_id = rule.id 
            AND status = 'active'
            AND triggered_at > NOW() - INTERVAL '1 hour'
        ) THEN
          -- Create new alert
          INSERT INTO alerts (
            rule_id, metric_type, metric_value, threshold, 
            severity, message, status
          ) VALUES (
            rule.id, rule.metric_type, current_value, rule.threshold,
            rule.severity, 
            format('%s: %s %s %s (actual: %s)', 
              rule.name, rule.metric_type, rule.condition, 
              rule.threshold, current_value),
            'active'
          );
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate Cohen's Kappa
CREATE OR REPLACE FUNCTION calculate_cohens_kappa(
  annotator1 VARCHAR,
  annotator2 VARCHAR,
  start_date DATE,
  end_date DATE
) RETURNS DECIMAL AS $$
DECLARE
  po DECIMAL; -- Observed agreement
  pe DECIMAL; -- Expected agreement
  kappa DECIMAL;
BEGIN
  -- This is a simplified implementation
  -- In practice, you'd need to compare actual annotations
  
  WITH agreements AS (
    SELECT 
      COUNT(*) FILTER (WHERE t1.result->>'classification' = t2.result->>'classification') as agreed,
      COUNT(*) as total
    FROM tasks t1
    JOIN tasks t2 ON t1.request_id = t2.request_id
    WHERE t1.assigned_to = annotator1
      AND t2.assigned_to = annotator2
      AND t1.created_at >= start_date
      AND t1.created_at < end_date + INTERVAL '1 day'
  )
  SELECT 
    agreed::DECIMAL / NULLIF(total, 0),
    0.25 -- Placeholder for expected agreement
  INTO po, pe
  FROM agreements;
  
  IF po IS NULL OR pe IS NULL THEN
    RETURN NULL;
  END IF;
  
  kappa := (po - pe) / (1 - pe);
  RETURN kappa;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE metrics_history IS 'Time-series metrics data for analytics';
COMMENT ON TABLE metrics_aggregations IS 'Pre-calculated metric aggregations for performance';
COMMENT ON TABLE alert_rules IS 'Configurable alert rules for metric thresholds';
COMMENT ON TABLE alerts IS 'Triggered alerts from rule violations';
COMMENT ON TABLE kpi_targets IS 'Target values for KPI tracking';
COMMENT ON TABLE iaa_scores IS 'Inter-Annotator Agreement scores for quality measurement';
COMMENT ON COLUMN iaa_scores.kappa_score IS 'Cohen Kappa score: -1 (complete disagreement) to 1 (perfect agreement)';