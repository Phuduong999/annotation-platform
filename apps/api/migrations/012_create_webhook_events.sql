-- Create webhook_events table to track webhook notifications
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  webhook_url VARCHAR(2048) NOT NULL,
  payload JSONB,
  status VARCHAR(20) CHECK (status IN ('success', 'failed')) NOT NULL,
  error_message TEXT,
  response_status INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_webhook_events_alert_id ON webhook_events(alert_id);
CREATE INDEX idx_webhook_events_rule_id ON webhook_events(rule_id);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at DESC);

-- Composite index for common queries
CREATE INDEX idx_webhook_events_status_created ON webhook_events(status, created_at DESC);

-- Comments
COMMENT ON TABLE webhook_events IS 'Logs all webhook notification attempts for alerts';
COMMENT ON COLUMN webhook_events.alert_id IS 'Alert that triggered the webhook';
COMMENT ON COLUMN webhook_events.rule_id IS 'Alert rule that triggered the webhook';
COMMENT ON COLUMN webhook_events.webhook_url IS 'URL where webhook was sent';
COMMENT ON COLUMN webhook_events.payload IS 'JSON payload sent to webhook';
COMMENT ON COLUMN webhook_events.status IS 'Success or failure status of webhook';
COMMENT ON COLUMN webhook_events.error_message IS 'Error message if webhook failed';
COMMENT ON COLUMN webhook_events.response_status IS 'HTTP response status code';
COMMENT ON COLUMN webhook_events.response_time_ms IS 'Response time in milliseconds';