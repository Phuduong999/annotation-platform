-- Migration 015: Fix alert_rules schema to match AlertService requirements
-- Add missing columns and rename columns to match code expectations

-- 1. Add evaluation_period column
ALTER TABLE alert_rules 
ADD COLUMN IF NOT EXISTS evaluation_period INTEGER DEFAULT 300;

COMMENT ON COLUMN alert_rules.evaluation_period IS 'Time period in seconds to evaluate the alert condition';

-- 2. Add project_id column
ALTER TABLE alert_rules 
ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);

COMMENT ON COLUMN alert_rules.project_id IS 'Project identifier for multi-tenant alert rules';

-- 3. Add is_active column (alias for is_enabled)
ALTER TABLE alert_rules 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Sync is_active with is_enabled for existing rows
UPDATE alert_rules 
SET is_active = is_enabled 
WHERE is_active IS NULL;

-- 4. Add notification_channels column (alias for notify_channels)
ALTER TABLE alert_rules 
ADD COLUMN IF NOT EXISTS notification_channels JSONB;

-- Sync notification_channels with notify_channels for existing rows
UPDATE alert_rules 
SET notification_channels = notify_channels 
WHERE notification_channels IS NULL;

COMMENT ON COLUMN alert_rules.notification_channels IS 'Array of notification channel names';

-- 5. Create unique constraint on (name, project_id)
-- Drop existing constraint if it exists
ALTER TABLE alert_rules 
DROP CONSTRAINT IF EXISTS alert_rules_name_project_id_key;

-- Add new constraint (allowing NULL project_id for global rules)
CREATE UNIQUE INDEX IF NOT EXISTS alert_rules_name_project_id_idx 
ON alert_rules (name, COALESCE(project_id, ''));

-- 6. Set default values for existing rows
UPDATE alert_rules 
SET evaluation_period = 300 
WHERE evaluation_period IS NULL;

UPDATE alert_rules 
SET project_id = '' 
WHERE project_id IS NULL;
