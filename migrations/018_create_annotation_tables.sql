-- Migration 018: Create annotation workflow tables
-- Created: 2025-10-11
-- Purpose: Support labels_draft, labels_final, and task_events for annotation workflow

-- Task event types
CREATE TYPE task_event_type AS ENUM ('start', 'annotate_draft', 'submit', 'skip', 'assign');

-- Task events table - log all task actions
CREATE TABLE IF NOT EXISTS task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type task_event_type NOT NULL,
  user_id VARCHAR(255),
  meta JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_events_task_id ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_events_type ON task_events(type);
CREATE INDEX IF NOT EXISTS idx_task_events_created_at ON task_events(created_at DESC);

-- Labels draft table - store work-in-progress annotations
CREATE TABLE IF NOT EXISTS labels_draft (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  updated_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labels_draft_task_id ON labels_draft(task_id);
CREATE INDEX IF NOT EXISTS idx_labels_draft_updated_at ON labels_draft(updated_at DESC);

-- Labels final table - store submitted annotations
CREATE TABLE IF NOT EXISTS labels_final (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
  scan_type VARCHAR(100) NOT NULL,
  result_return VARCHAR(50) NOT NULL,
  feedback_correction TEXT[], -- Array of correction types
  note TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labels_final_task_id ON labels_final(task_id);
CREATE INDEX IF NOT EXISTS idx_labels_final_scan_type ON labels_final(scan_type);
CREATE INDEX IF NOT EXISTS idx_labels_final_result_return ON labels_final(result_return);
CREATE INDEX IF NOT EXISTS idx_labels_final_created_at ON labels_final(created_at DESC);

-- Add constraint to ensure annotation data integrity
ALTER TABLE labels_final
  ADD CONSTRAINT IF NOT EXISTS check_scan_type 
  CHECK (scan_type IN ('meal', 'label', 'front_label', 'screenshot', 'others'));

ALTER TABLE labels_final
  ADD CONSTRAINT IF NOT EXISTS check_result_return
  CHECK (result_return IN ('correct_result', 'wrong_result', 'no_result'));

COMMENT ON TABLE task_events IS 'Audit log of all task state changes and actions';
COMMENT ON TABLE labels_draft IS 'Work-in-progress annotations (auto-saved drafts)';
COMMENT ON TABLE labels_final IS 'Finalized annotations after submission';
COMMENT ON COLUMN labels_final.feedback_correction IS 'Array of correction types for end-user feedback evaluation';
