// Task types and interfaces

export interface Task {
  id: string;
  import_row_id: string;
  scan_date: string;
  request_id: string;
  user_id: string;
  team_id: string;
  type: 'meal' | 'label' | 'front_label' | 'screenshot' | 'others'; // this need to come from csv data, we need to 
  user_input: string;
  raw_ai_output: string;
  ai_confidence: number; // need to remove
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assigned_to: string | null;
  assigned_at: string | null;
  assignment_method: 'equal_split' | 'pull_queue' | null;
  completed_at: string | null;
  result: TaskResult | null;
  created_at: string;
  updated_at: string;
  user_email?: string | null;
  logs?: string | null;
  raw_json?: unknown;
  end_user_feedback?: EndUserFeedback | null;
}

export interface TaskResult {
  classification: string;
  tags?: string[];
  nutrition?: NutritionData;
  annotated_by?: string;
  annotated_at?: string;
}

export interface NutritionData {
  groups: NutritionGroup[];
  total: NutritionSummary;
}

export interface NutritionGroup {
  name: string;
  items: NutritionItem[];
}

export interface NutritionItem {
  name: string;
  amount: number;
  unit: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

export interface NutritionSummary {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  calculated_calories?: number;
  calorie_deviation?: number;
}

export interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
  unassigned: number;
}

export interface TaskFilter {
  status?: Task['status'];
  assigned_to_me?: boolean;
  team_id?: string;
  type?: Task['type'];
  date_from?: string;
  date_to?: string;
  has_dislike?: boolean;
  feedback_category?: string;
  limit?: number;
  offset?: number;
}

export interface TaskPagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface TaskListResponse {
  tasks: Task[];
  pagination: TaskPagination;
}

export interface ParsedAIOutput {
  classification?: string;
  confidence?: number;
  nutrition?: NutritionData;
  detected_items?: string[];
  warnings?: string[];
  [key: string]: any;
}

export interface TaskAnnotation {
  classification: 'meal' | 'label' | 'front_label' | 'screenshot' | 'others';
  tags: string[];
  nutrition?: NutritionData;
  scan_type_judgement?: 'correct_type' | 'wrong_type';
  result_return_judgement?: 'result_return' | 'no_result_return';
}

export interface EndUserFeedback {
  id: string;
  request_id: string;
  user_event_id?: string;
  reaction: 'like' | 'dislike' | 'neutral';
  category?: string;
  note?: string;
  source: string;
  created_at: string;
}
