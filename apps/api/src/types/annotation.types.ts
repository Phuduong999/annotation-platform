// Task annotation system types and enums

export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'skipped';

export type TaskEventType = 'start' | 'annotate_draft' | 'submit' | 'skip' | 'assign';

export type AssignmentMethod = 'equal_split' | 'pull_queue' | 'skip';

export type ScanType = 'meal' | 'label' | 'front_label' | 'screenshot' | 'others';

export type ResultReturn = 'correct_result' | 'wrong_result' | 'no_result';

export type FeedbackCorrection = 'wrong_food' | 'incorrect_nutrition' | 'incorrect_ingredients' | 'wrong_portion_size' | 'no_feedback' | 'correct_feedback';

export interface AnnotationRequest {
  scan_type: ScanType;
  result_return: ResultReturn;
  feedback_correction?: FeedbackCorrection;
  note?: string;
  draft?: boolean;
}

export interface StartTaskRequest {
  user_id: string;
}

export interface SkipTaskRequest {
  user_id: string;
  reason_code?: string;
}

export interface TaskEvent {
  id: string;
  task_id: string;
  type: TaskEventType;
  user_id?: string;
  meta?: Record<string, any>;
  created_at: string;
}

export interface LabelsDraft {
  id: string;
  task_id: string;
  payload: AnnotationRequest;
  updated_by: string;
  updated_at: string;
}

export interface LabelsFinal {
  id: string;
  task_id: string;
  scan_type: ScanType;
  result_return: ResultReturn;
  feedback_correction: FeedbackCorrection;
  note?: string;
  created_by: string;
  created_at: string;
}

export interface TaskWithAnnotations {
  id: string;
  request_id: string;
  user_id: string;
  team_id: string;
  scan_type: ScanType;
  user_input: string;
  raw_ai_output: any;
  ai_confidence: number;
  status: TaskStatus;
  assigned_to?: string;
  assigned_at?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  created_at: string;
  updated_at: string;
  draft?: LabelsDraft;
  final?: LabelsFinal;
}

// Validation helpers
export const SCAN_TYPES: ScanType[] = ['meal', 'label', 'front_label', 'screenshot', 'others'];
export const RESULT_RETURNS: ResultReturn[] = ['correct_result', 'wrong_result', 'no_result'];
export const FEEDBACK_CORRECTIONS: FeedbackCorrection[] = ['wrong_food', 'incorrect_nutrition', 'incorrect_ingredients', 'wrong_portion_size', 'no_feedback', 'correct_feedback'];

export function validateScanType(value: string): value is ScanType {
  return SCAN_TYPES.includes(value as ScanType);
}

export function validateResultReturn(value: string): value is ResultReturn {
  return RESULT_RETURNS.includes(value as ResultReturn);
}

export function validateFeedbackCorrection(value: string): value is FeedbackCorrection {
  return FEEDBACK_CORRECTIONS.includes(value as FeedbackCorrection);
}

export function validateAnnotation(annotation: AnnotationRequest): string[] {
  const errors: string[] = [];
  
  if (!validateScanType(annotation.scan_type)) {
    errors.push(`Invalid scan_type. Must be one of: ${SCAN_TYPES.join(', ')}`);
  }
  
  if (!validateResultReturn(annotation.result_return)) {
    errors.push(`Invalid result_return. Must be one of: ${RESULT_RETURNS.join(', ')}`);
  }
  
  if (annotation.feedback_correction && !validateFeedbackCorrection(annotation.feedback_correction)) {
    errors.push(`Invalid feedback_correction. Must be one of: ${FEEDBACK_CORRECTIONS.join(', ')}`);
  }
  
  return errors;
}