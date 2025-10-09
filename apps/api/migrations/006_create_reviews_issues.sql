-- Create review reason codes enum
CREATE TYPE review_reason_code AS ENUM (
  'incorrect_classification',
  'missing_tags', 
  'wrong_tags',
  'nutrition_error',
  'incomplete_annotation',
  'guideline_violation',
  'technical_issue',
  'other'
);

-- Create review action enum
CREATE TYPE review_action AS ENUM (
  'accept',
  'reject',
  'request_changes'
);

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id),
  reviewer_id VARCHAR(255) NOT NULL,
  action review_action NOT NULL,
  reason_code review_reason_code,
  reason_details TEXT,
  original_annotation JSONB,
  reviewed_annotation JSONB,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT reason_code_required CHECK (
    action != 'reject' OR reason_code IS NOT NULL
  )
);

-- Create issues/comments table
CREATE TABLE IF NOT EXISTS review_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id),
  author_id VARCHAR(255) NOT NULL,
  field_name VARCHAR(100),
  issue_type VARCHAR(50) CHECK (issue_type IN ('error', 'warning', 'suggestion', 'comment')),
  description TEXT NOT NULL,
  original_value TEXT,
  suggested_value TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create review stats table for analytics
CREATE TABLE IF NOT EXISTS review_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id VARCHAR(255) NOT NULL,
  annotator_id VARCHAR(255) NOT NULL,
  task_type VARCHAR(50),
  total_reviewed INTEGER DEFAULT 0,
  total_accepted INTEGER DEFAULT 0,
  total_rejected INTEGER DEFAULT 0,
  avg_review_time_seconds INTEGER,
  common_reason_codes JSONB,
  period_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(reviewer_id, annotator_id, period_date)
);

-- Indexes for reviews
CREATE INDEX idx_reviews_task_id ON reviews(task_id);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_action ON reviews(action);
CREATE INDEX idx_reviews_reason_code ON reviews(reason_code) WHERE reason_code IS NOT NULL;
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);

-- Indexes for issues
CREATE INDEX idx_review_issues_review_id ON review_issues(review_id);
CREATE INDEX idx_review_issues_task_id ON review_issues(task_id);
CREATE INDEX idx_review_issues_author_id ON review_issues(author_id);
CREATE INDEX idx_review_issues_resolved ON review_issues(resolved);
CREATE INDEX idx_review_issues_issue_type ON review_issues(issue_type);

-- Indexes for stats
CREATE INDEX idx_review_stats_reviewer_id ON review_stats(reviewer_id);
CREATE INDEX idx_review_stats_annotator_id ON review_stats(annotator_id);
CREATE INDEX idx_review_stats_period_date ON review_stats(period_date);

-- Add review-related columns to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS review_status VARCHAR(50) DEFAULT 'pending_review',
ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_rejection_reason review_reason_code;

-- Add constraint for review status
ALTER TABLE tasks
ADD CONSTRAINT check_review_status CHECK (
  review_status IN ('pending_review', 'in_review', 'accepted', 'rejected', 'skipped')
);

-- Trigger to update review_count on rejection
CREATE OR REPLACE FUNCTION update_task_review_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.action = 'reject' THEN
    UPDATE tasks 
    SET 
      review_count = review_count + 1,
      last_rejection_reason = NEW.reason_code,
      review_status = 'rejected',
      assigned_to = NULL,
      status = 'pending'
    WHERE id = NEW.task_id;
  ELSIF NEW.action = 'accept' THEN
    UPDATE tasks
    SET
      review_status = 'accepted',
      reviewed_by = NEW.reviewer_id,
      reviewed_at = NEW.created_at
    WHERE id = NEW.task_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_task_review_count
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_task_review_count();

-- Comments
COMMENT ON TABLE reviews IS 'Stores peer review decisions for annotated tasks';
COMMENT ON TABLE review_issues IS 'Stores specific issues and comments raised during review';
COMMENT ON TABLE review_stats IS 'Aggregated statistics for review performance';
COMMENT ON COLUMN reviews.reason_code IS 'Required reason code when rejecting a task';
COMMENT ON COLUMN review_issues.field_name IS 'Specific field the issue relates to (e.g., classification, tags)';
COMMENT ON COLUMN tasks.review_count IS 'Number of times this task has been rejected';