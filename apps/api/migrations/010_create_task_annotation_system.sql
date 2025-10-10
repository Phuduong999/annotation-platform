-- Migration: Task Annotation System Tables
-- Creates tables for task annotation workflow with proper enums and constraints

-- Add missing columns to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

-- Create task_events table for audit trail
CREATE TABLE IF NOT EXISTS task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('start', 'annotate_draft', 'submit', 'skip', 'assign')),
  user_id VARCHAR(255),
  meta JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_events_task_id ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_events_type ON task_events(type);
CREATE INDEX IF NOT EXISTS idx_task_events_created_at ON task_events(created_at);

-- Create labels_draft table for draft annotations
CREATE TABLE IF NOT EXISTS labels_draft (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  updated_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(task_id)
);

CREATE INDEX IF NOT EXISTS idx_labels_draft_task_id ON labels_draft(task_id);
CREATE INDEX IF NOT EXISTS idx_labels_draft_updated_by ON labels_draft(updated_by);

-- Create labels_final table for final annotations
CREATE TABLE IF NOT EXISTS labels_final (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  scan_type VARCHAR(50) NOT NULL CHECK (scan_type IN ('meal', 'label', 'front_label', 'screenshot', 'others')),
  result_return VARCHAR(50) NOT NULL CHECK (result_return IN ('correct_result', 'wrong_result', 'no_result')),
  feedback_correction VARCHAR(100) NOT NULL CHECK (feedback_correction IN ('wrong_food', 'incorrect_nutrition', 'incorrect_ingredients', 'wrong_portion_size')),
  note TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(task_id)
);

CREATE INDEX IF NOT EXISTS idx_labels_final_task_id ON labels_final(task_id);
CREATE INDEX IF NOT EXISTS idx_labels_final_created_by ON labels_final(created_by);
CREATE INDEX IF NOT EXISTS idx_labels_final_scan_type ON labels_final(scan_type);

-- Update task_assignments table to include skip method
ALTER TABLE task_assignments 
ALTER COLUMN assignment_method TYPE VARCHAR(50);

-- Add check constraint for assignment_method enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'task_assignments_method_check'
  ) THEN
    ALTER TABLE task_assignments 
    ADD CONSTRAINT task_assignments_method_check 
    CHECK (assignment_method IN ('equal_split', 'pull_queue', 'skip'));
  END IF;
END $$;