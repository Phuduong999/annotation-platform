-- Migration 016: Fix alert_rules unique constraint for ON CONFLICT
-- Replace index with proper unique constraint

-- 1. Drop the existing index
DROP INDEX IF EXISTS alert_rules_name_project_id_idx;

-- 2. Ensure project_id has default value (empty string for global rules)
UPDATE alert_rules 
SET project_id = '' 
WHERE project_id IS NULL;

-- 3. Set project_id to NOT NULL with default
ALTER TABLE alert_rules 
ALTER COLUMN project_id SET DEFAULT '';

ALTER TABLE alert_rules 
ALTER COLUMN project_id SET NOT NULL;

-- 4. Create proper unique constraint on (name, project_id)
-- This will allow ON CONFLICT to work properly
ALTER TABLE alert_rules 
ADD CONSTRAINT alert_rules_name_project_id_unique 
UNIQUE (name, project_id);

-- Add comment
COMMENT ON CONSTRAINT alert_rules_name_project_id_unique ON alert_rules 
IS 'Ensures alert rule names are unique per project (empty string for global rules)';
