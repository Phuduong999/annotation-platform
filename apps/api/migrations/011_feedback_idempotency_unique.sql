-- Add unique constraint for (request_id, user_event_id) to prevent duplicates
-- Add idempotency key column for request deduplication

-- Add idempotency_key column
ALTER TABLE feedback_events 
ADD COLUMN idempotency_key VARCHAR(255);

-- Create unique index on (request_id, user_event_id) where user_event_id is not null
-- This prevents duplicate feedback for the same request+user_event combination
CREATE UNIQUE INDEX CONCURRENTLY idx_feedback_events_unique_request_user_event 
ON feedback_events(request_id, user_event_id) 
WHERE user_event_id IS NOT NULL;

-- Create unique index on idempotency_key where it's not null
-- This prevents duplicate requests with the same idempotency key
CREATE UNIQUE INDEX CONCURRENTLY idx_feedback_events_unique_idempotency_key 
ON feedback_events(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Add partial unique constraint for request_id when user_event_id is null
-- This allows only one feedback per request_id when no user_event_id is provided
CREATE UNIQUE INDEX CONCURRENTLY idx_feedback_events_unique_request_only 
ON feedback_events(request_id) 
WHERE user_event_id IS NULL;

-- Add index for idempotency key lookups
CREATE INDEX CONCURRENTLY idx_feedback_events_idempotency_key 
ON feedback_events(idempotency_key);

-- Update comments
COMMENT ON COLUMN feedback_events.idempotency_key IS 'Idempotency key to prevent duplicate submissions';
COMMENT ON INDEX idx_feedback_events_unique_request_user_event IS 'Ensures unique feedback per request+user_event combination';
COMMENT ON INDEX idx_feedback_events_unique_idempotency_key IS 'Ensures idempotent requests using idempotency keys';
COMMENT ON INDEX idx_feedback_events_unique_request_only IS 'Ensures unique feedback per request when no user_event_id';