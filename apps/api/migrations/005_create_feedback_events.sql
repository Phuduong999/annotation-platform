-- Create feedback_events table to store end-user feedback
CREATE TABLE IF NOT EXISTS feedback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id VARCHAR(255) NOT NULL,
  user_event_id VARCHAR(255),
  reaction VARCHAR(20) CHECK (reaction IN ('like', 'dislike', 'neutral')),
  category VARCHAR(100),
  note TEXT,
  source VARCHAR(50) NOT NULL DEFAULT 'end_user',
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for efficient lookup by request_id
CREATE INDEX idx_feedback_events_request_id ON feedback_events(request_id);

-- Index for filtering by category
CREATE INDEX idx_feedback_events_category ON feedback_events(category) WHERE category IS NOT NULL;

-- Index for filtering by reaction
CREATE INDEX idx_feedback_events_reaction ON feedback_events(reaction) WHERE reaction IS NOT NULL;

-- Index for timestamp-based queries
CREATE INDEX idx_feedback_events_created_at ON feedback_events(created_at DESC);

-- Composite index for common query patterns
CREATE INDEX idx_feedback_events_request_reaction ON feedback_events(request_id, reaction);

-- Add comment
COMMENT ON TABLE feedback_events IS 'Stores end-user feedback for requests/tasks';
COMMENT ON COLUMN feedback_events.request_id IS 'Links to the original request/task';
COMMENT ON COLUMN feedback_events.user_event_id IS 'Optional ID from the end-user system';
COMMENT ON COLUMN feedback_events.reaction IS 'User reaction: like, dislike, or neutral';
COMMENT ON COLUMN feedback_events.category IS 'Feedback category for filtering/grouping';
COMMENT ON COLUMN feedback_events.note IS 'Optional text note from end-user';
COMMENT ON COLUMN feedback_events.source IS 'Source system of the feedback';
COMMENT ON COLUMN feedback_events.metadata IS 'Additional metadata in JSON format';