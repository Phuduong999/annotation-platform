#!/bin/bash
# Auto-create tasks from valid import_rows and assign to user123
# Usage: ./auto-create-tasks-user123.sh [job_id]

JOB_ID=${1:-""}

if [ -z "$JOB_ID" ]; then
  # Process all valid rows
  WHERE_CLAUSE="ir.status = 'valid'"
else
  # Process specific job
  WHERE_CLAUSE="ir.import_job_id = '$JOB_ID' AND ir.status = 'valid'"
fi

docker exec -i monorepo-postgres psql -U postgres -d monorepo << EOF
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
SELECT DISTINCT ON (ir.row_data->>'request_id')
  ir.id,
  ir.row_data->>'request_id',
  ir.row_data->>'user_id',
  ir.row_data->>'team_id',
  ir.row_data->>'type',
  ir.row_data->>'user_input',
  (ir.row_data->>'raw_ai_output')::jsonb,
  0.85,
  (ir.row_data->>'date')::timestamp,
  'pending',
  'user123',
  ir.row_data->>'user_email',
  ir.row_data->>'user_full_name',
  ir.row_data->>'user_log',
  ir.row_data->>'raw_user_log',
  CASE 
    WHEN ir.row_data->>'is_logged' = 'true' THEN true 
    WHEN ir.row_data->>'is_logged' = 'false' THEN false 
    ELSE NULL 
  END,
  ir.row_data->>'edit_category',
  ir.row_data->>'ai_output_log'
FROM import_rows ir
WHERE $WHERE_CLAUSE
  AND NOT EXISTS (
    SELECT 1 FROM tasks t 
    WHERE t.request_id = ir.row_data->>'request_id'
  )
ORDER BY ir.row_data->>'request_id', ir.created_at DESC;

-- Show created tasks
SELECT COUNT(*) as tasks_created FROM tasks WHERE assigned_to = 'user123';
EOF

echo ""
echo "✅ Tasks created and assigned to user123"
echo "🔗 View at: http://localhost:3000/tasks"
