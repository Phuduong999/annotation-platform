-- Create task_events audit table for comprehensive task history tracking
CREATE TABLE IF NOT EXISTS task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'task_created',
    'task_assigned',
    'task_started',
    'annotation_draft_saved',
    'task_completed',
    'task_skipped',
    'task_failed',
    'task_reassigned',
    'task_updated'
  )),
  user_id VARCHAR(255),
  old_status VARCHAR(50),
  new_status VARCHAR(50) CHECK (new_status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  old_assigned_to VARCHAR(255),
  new_assigned_to VARCHAR(255),
  annotation_data JSONB,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add skip_count column to tasks table if not exists
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS skip_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS annotation JSONB;

-- Indexes for performance
CREATE INDEX idx_task_events_task_id ON task_events(task_id);
CREATE INDEX idx_task_events_event_type ON task_events(event_type);
CREATE INDEX idx_task_events_user_id ON task_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_task_events_created_at ON task_events(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX idx_task_events_task_type ON task_events(task_id, event_type);
CREATE INDEX idx_task_events_task_created ON task_events(task_id, created_at DESC);

-- Index for audit trail queries
CREATE INDEX idx_task_events_user_created ON task_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- Comments
COMMENT ON TABLE task_events IS 'Comprehensive audit log of all task state changes and actions';
COMMENT ON COLUMN task_events.task_id IS 'Reference to the task being modified';
COMMENT ON COLUMN task_events.event_type IS 'Type of event that occurred';
COMMENT ON COLUMN task_events.user_id IS 'User who triggered the event';
COMMENT ON COLUMN task_events.old_status IS 'Task status before the event';
COMMENT ON COLUMN task_events.new_status IS 'Task status after the event';
COMMENT ON COLUMN task_events.annotation_data IS 'Annotation data saved with the event';
COMMENT ON COLUMN task_events.metadata IS 'Additional context and metadata for the event';
COMMENT ON COLUMN task_events.ip_address IS 'IP address of the user who triggered the event';
COMMENT ON COLUMN task_events.user_agent IS 'User agent of the client that triggered the event';

-- Function to automatically log task changes
CREATE OR REPLACE FUNCTION log_task_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status changed or assignment changed
  IF (TG_OP = 'UPDATE' AND (
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.assigned_to IS DISTINCT FROM NEW.assigned_to
  )) THEN
    INSERT INTO task_events (
      task_id,
      event_type,
      old_status,
      new_status,
      old_assigned_to,
      new_assigned_to,
      metadata
    ) VALUES (
      NEW.id,
      CASE
        WHEN OLD.status = 'pending' AND NEW.status = 'in_progress' THEN 'task_started'
        WHEN OLD.status = 'in_progress' AND NEW.status = 'completed' THEN 'task_completed'
        WHEN OLD.status = 'in_progress' AND NEW.status = 'pending' THEN 'task_skipped'
        WHEN OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN 'task_reassigned'
        ELSE 'task_updated'
      END,
      OLD.status,
      NEW.status,
      OLD.assigned_to,
      NEW.assigned_to,
      jsonb_build_object(
        'updated_at', NEW.updated_at,
        'completed_at', NEW.completed_at
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic logging
DROP TRIGGER IF EXISTS task_change_trigger ON tasks;
CREATE TRIGGER task_change_trigger
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_change();

-- View for easy audit trail access
CREATE OR REPLACE VIEW task_audit_trail AS
SELECT 
  te.id,
  te.task_id,
  t.request_id,
  te.event_type,
  te.user_id,
  te.old_status,
  te.new_status,
  te.old_assigned_to,
  te.new_assigned_to,
  te.annotation_data,
  te.metadata,
  te.created_at,
  t.type as task_type,
  t.team_id
FROM task_events te
JOIN tasks t ON te.task_id = t.id
ORDER BY te.created_at DESC;

COMMENT ON VIEW task_audit_trail IS 'Comprehensive view of task audit trail with task context';