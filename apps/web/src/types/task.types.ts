// Task types and interfaces

export interface Task {
  id: string;
  import_row_id: string;
  scan_date: string;
  request_id: string;
  user_id: string;
  team_id: string;
  type: 'explicit' | 'adult' | 'suggestive' | 'medical';
  user_input: string;
  raw_ai_output: string;
  ai_confidence: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assigned_to: string | null;
  assigned_at: string | null;
  assignment_method: 'equal_split' | 'pull_queue' | null;
  completed_at: string | null;
  result: TaskResult | null;
  created_at: string;
  updated_at: string;
}

export interface TaskResult {
  classification: string;
  feedback?: string;
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
  classification: 'explicit' | 'adult' | 'suggestive' | 'medical' | 'safe';
  tags: string[];
  feedback: string;
  nutrition?: NutritionData;
}