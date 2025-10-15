-- Migration: Update task status constraint
-- Date: 2025-10-13
-- Description: Update task status constraint to include 'assigned', 'in_progress', 'rejected', and 'skipped'

-- Drop old constraint (if exists)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS check_task_status;

-- Add updated constraint with all valid statuses
ALTER TABLE tasks 
ADD CONSTRAINT check_task_status 
CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'failed', 'rejected', 'skipped'));

-- Comment for documentation
COMMENT ON CONSTRAINT check_task_status ON tasks IS 'Valid task statuses: pending (not assigned), assigned (assigned but not started), in_progress (actively being worked on), completed (finished with annotation), failed (system error), rejected (quality issue), skipped (user skipped)';
