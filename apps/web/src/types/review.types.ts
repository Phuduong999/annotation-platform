// Review types and interfaces

export type ReviewAction = 'accept' | 'reject' | 'request_changes';

export type ReviewReasonCode = 
  | 'incorrect_classification'
  | 'missing_tags'
  | 'wrong_tags'
  | 'nutrition_error'
  | 'incomplete_annotation'
  | 'guideline_violation'
  | 'technical_issue'
  | 'other';

export type IssueType = 'error' | 'warning' | 'suggestion' | 'comment';

export type ReviewStatus = 'pending_review' | 'in_review' | 'accepted' | 'rejected' | 'skipped';

export interface Review {
  id: string;
  task_id: string;
  reviewer_id: string;
  action: ReviewAction;
  reason_code?: ReviewReasonCode;
  reason_details?: string;
  original_annotation?: any;
  reviewed_annotation?: any;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ReviewIssue {
  id: string;
  review_id: string;
  task_id: string;
  author_id: string;
  field_name?: string;
  issue_type: IssueType;
  description: string;
  original_value?: string;
  suggested_value?: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ReviewStats {
  id: string;
  reviewer_id: string;
  annotator_id: string;
  task_type?: string;
  total_reviewed: number;
  total_accepted: number;
  total_rejected: number;
  avg_review_time_seconds?: number;
  common_reason_codes?: Record<ReviewReasonCode, number>;
  period_date: string;
  created_at: string;
  updated_at: string;
}

export interface CreateReviewRequest {
  task_id: string;
  action: ReviewAction;
  reason_code?: ReviewReasonCode;
  reason_details?: string;
  original_annotation?: any;
  reviewed_annotation?: any;
  issues?: CreateIssueRequest[];
}

export interface CreateIssueRequest {
  field_name?: string;
  issue_type: IssueType;
  description: string;
  original_value?: string;
  suggested_value?: string;
}

export interface ReviewDiff {
  field: string;
  original: any;
  reviewed: any;
  changed: boolean;
}

export interface ReviewFilter {
  reviewer_id?: string;
  annotator_id?: string;
  action?: ReviewAction;
  reason_code?: ReviewReasonCode;
  from_date?: string;
  to_date?: string;
  task_type?: string;
}

// Reason code labels for UI
export const REASON_CODE_LABELS: Record<ReviewReasonCode, string> = {
  incorrect_classification: 'Incorrect Classification',
  missing_tags: 'Missing Tags',
  wrong_tags: 'Wrong Tags',
  nutrition_error: 'Nutrition Data Error',
  incomplete_annotation: 'Incomplete Annotation',
  guideline_violation: 'Guideline Violation',
  technical_issue: 'Technical Issue',
  other: 'Other Reason',
};

// Issue type colors for UI
export const ISSUE_TYPE_COLORS: Record<IssueType, string> = {
  error: 'red',
  warning: 'yellow',
  suggestion: 'blue',
  comment: 'gray',
};

// Review action colors for UI
export const REVIEW_ACTION_COLORS: Record<ReviewAction, string> = {
  accept: 'green',
  reject: 'red',
  request_changes: 'yellow',
};