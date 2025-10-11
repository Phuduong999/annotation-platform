-- Migration 014: Add extended user fields to tasks and import_rows
-- Adds fields to support full JSON import with user metadata

-- Add new columns to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS user_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS user_full_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS user_log TEXT,
ADD COLUMN IF NOT EXISTS raw_user_log TEXT,
ADD COLUMN IF NOT EXISTS is_logged BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS edit_category VARCHAR(255),
ADD COLUMN IF NOT EXISTS ai_output_log TEXT;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_email ON tasks(user_email);
CREATE INDEX IF NOT EXISTS idx_tasks_is_logged ON tasks(is_logged) WHERE is_logged = TRUE;
CREATE INDEX IF NOT EXISTS idx_tasks_edit_category ON tasks(edit_category) WHERE edit_category IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN tasks.user_email IS 'Email address of the user who created the scan';
COMMENT ON COLUMN tasks.user_full_name IS 'Full name of the user';
COMMENT ON COLUMN tasks.user_log IS 'User-provided log or notes';
COMMENT ON COLUMN tasks.raw_user_log IS 'Raw unprocessed user log data';
COMMENT ON COLUMN tasks.is_logged IS 'Whether this scan has been logged by the user';
COMMENT ON COLUMN tasks.edit_category IS 'Category for edits/corrections';
COMMENT ON COLUMN tasks.ai_output_log IS 'Alternative AI output log format';
