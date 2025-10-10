-- Add unique constraint for alert rules
-- This prevents duplicate rules for the same metric in a project

-- Add unique constraint on name and project_id
ALTER TABLE alert_rules 
ADD CONSTRAINT unique_alert_rule_per_project 
UNIQUE (name, project_id);

-- Add index for faster alert evaluation queries
CREATE INDEX IF NOT EXISTS idx_alerts_status_triggered 
ON alerts (status, triggered_at DESC)
WHERE status IN ('active', 'acknowledged');

-- Add index for metrics history queries used by alert engine
CREATE INDEX IF NOT EXISTS idx_metrics_history_alert_eval 
ON metrics_history (metric_type, recorded_at DESC, project_id)
WHERE recorded_at >= NOW() - INTERVAL '1 hour';

-- Add updated_at column to alerts table if not exists
ALTER TABLE alerts 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_alerts_updated_at_trigger ON alerts;

CREATE TRIGGER update_alerts_updated_at_trigger
BEFORE UPDATE ON alerts
FOR EACH ROW
EXECUTE FUNCTION update_alerts_updated_at();