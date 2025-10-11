-- Script to create tasks from valid import_rows and assign to user123
-- This bypasses link check for testing purposes

INSERT INTO tasks (
  import_row_id,
  request_id,
  user_id,
  team_id,
  scan_type,
  user_input,
  raw_ai_output,
  ai_confidence,
  scan_date,
  status,
  assigned_to,
  user_email,
  user_full_name,
  user_log,
  raw_user_log,
  is_logged,
  edit_category,
  ai_output_log
)
SELECT 
  ir.id as import_row_id,
  ir.row_data->>'request_id' as request_id,
  ir.row_data->>'user_id' as user_id,
  ir.row_data->>'team_id' as team_id,
  ir.row_data->>'type' as scan_type,
  ir.row_data->>'user_input' as user_input,
  (ir.row_data->>'raw_ai_output')::jsonb as raw_ai_output,
  0.85 as ai_confidence, -- Default confidence
  (ir.row_data->>'date')::timestamp as scan_date,
  'pending' as status,
  'user123' as assigned_to, -- Assign all to user123 for testing
  ir.row_data->>'user_email' as user_email,
  ir.row_data->>'user_full_name' as user_full_name,
  ir.row_data->>'user_log' as user_log,
  ir.row_data->>'raw_user_log' as raw_user_log,
  CASE 
    WHEN ir.row_data->>'is_logged' = 'true' THEN true 
    WHEN ir.row_data->>'is_logged' = 'false' THEN false 
    ELSE NULL 
  END as is_logged,
  ir.row_data->>'edit_category' as edit_category,
  ir.row_data->>'ai_output_log' as ai_output_log
FROM import_rows ir
WHERE 
  ir.status = 'valid'
  AND NOT EXISTS (
    SELECT 1 FROM tasks t 
    WHERE t.request_id = ir.row_data->>'request_id'
  )
ON CONFLICT (request_id) DO UPDATE SET
  user_email = EXCLUDED.user_email,
  user_full_name = EXCLUDED.user_full_name,
  user_log = EXCLUDED.user_log,
  raw_user_log = EXCLUDED.raw_user_log,
  is_logged = EXCLUDED.is_logged,
  edit_category = EXCLUDED.edit_category,
  ai_output_log = EXCLUDED.ai_output_log,
  assigned_to = 'user123';

-- Show results
SELECT 
  request_id, 
  user_email, 
  user_full_name, 
  is_logged, 
  edit_category,
  assigned_to,
  status
FROM tasks 
WHERE assigned_to = 'user123'
ORDER BY created_at DESC
LIMIT 10;
