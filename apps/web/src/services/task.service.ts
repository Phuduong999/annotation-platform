import axios from 'axios';
import { Task, TaskStats, TaskFilter, TaskAnnotation, TaskListResponse } from '../types/task.types';

// New annotation types
export interface AnnotationRequest {
  scan_type: 'meal' | 'label' | 'front_label' | 'screenshot' | 'others';
  result_return: 'correct_result' | 'wrong_result' | 'no_result';
  feedback_correction: 'wrong_food' | 'incorrect_nutrition' | 'incorrect_ingredients' | 'wrong_portion_size';
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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export class TaskService {
  private apiUrl = `${API_BASE_URL}`;

  async getTasks(filter?: TaskFilter): Promise<TaskListResponse> {
    const params = new URLSearchParams();
    
    if (filter) {
      if (filter.status) params.append('status', filter.status);
      if (filter.assigned_to_me) params.append('assigned_to_me', 'true');
      if (filter.team_id) params.append('team_id', filter.team_id);
      if (filter.type) params.append('type', filter.type);
      if (filter.date_from) params.append('date_from', filter.date_from);
      if (filter.date_to) params.append('date_to', filter.date_to);
      if (typeof filter.limit === 'number') params.append('limit', filter.limit.toString());
      if (typeof filter.offset === 'number') params.append('offset', filter.offset.toString());
    }

    const queryString = params.toString();
    const response = await axios.get(queryString ? `${this.apiUrl}/tasks?${queryString}` : `${this.apiUrl}/tasks`);

    if (response.data.data?.tasks) {
      const { tasks, pagination } = response.data.data;
      return {
        tasks,
        pagination: {
          total: pagination?.total ?? tasks.length,
          limit: pagination?.limit ?? filter?.limit ?? tasks.length,
          offset: pagination?.offset ?? filter?.offset ?? 0,
          hasMore: pagination?.hasMore ?? false,
        },
      };
    }

    const fallbackTasks: Task[] = response.data.data || [];
    return {
      tasks: fallbackTasks,
      pagination: {
        total: fallbackTasks.length,
        limit: fallbackTasks.length,
        offset: 0,
        hasMore: false,
      },
    };
  }

  async getTask(id: string): Promise<Task> {
    const response = await axios.get(`${this.apiUrl}/tasks/${id}`);
    return response.data.data;
  }

  async getTaskStats(): Promise<TaskStats> {
    const response = await axios.get(`${this.apiUrl}/tasks/stats`);
    return response.data.data;
  }

  async getNextTask(userId: string): Promise<Task | null> {
    try {
      const response = await axios.get(`${this.apiUrl}/tasks/next?user_id=${userId}`);
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getUserTasks(userId: string): Promise<Task[]> {
    const response = await axios.get(`${this.apiUrl}/tasks/user/${userId}`);
    return response.data.data;
  }

  async saveTaskAnnotation(taskId: string, annotation: TaskAnnotation): Promise<Task> {
    const response = await axios.put(`${this.apiUrl}/tasks/${taskId}/annotate`, annotation);
    return response.data.data;
  }

  async submitTask(taskId: string, annotation: TaskAnnotation): Promise<Task> {
    const response = await axios.put(`${this.apiUrl}/tasks/${taskId}/submit`, annotation);
    return response.data.data;
  }

  async skipTask(taskId: string, reason?: string): Promise<Task> {
    const response = await axios.put(`${this.apiUrl}/tasks/${taskId}/skip`, { reason });
    return response.data.data;
  }

  // NEW ANNOTATION METHODS

  async startTask(taskId: string, userId: string): Promise<Task> {
    const response = await axios.put(`${this.apiUrl}/tasks/${taskId}/start`, {
      user_id: userId,
    });
    return response.data.data;
  }

  async saveAnnotationDraft(taskId: string, annotation: AnnotationRequest): Promise<any> {
    const response = await axios.put(`${this.apiUrl}/tasks/${taskId}/annotate`, {
      ...annotation,
      draft: true,
    });
    return response.data.data;
  }

  async submitTaskAnnotation(
    taskId: string, 
    annotation: AnnotationRequest, 
    idempotencyKey?: string
  ): Promise<Task> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['idempotency-key'] = idempotencyKey;
    }
    
    const response = await axios.put(`${this.apiUrl}/tasks/${taskId}/submit`, annotation, {
      headers,
    });
    return response.data.data;
  }

  async skipTaskNew(taskId: string, request: SkipTaskRequest): Promise<{ task: Task; nextTask?: Task }> {
    const response = await axios.put(`${this.apiUrl}/tasks/${taskId}/skip`, request);
    return response.data.data;
  }

  // Auto-save draft with debouncing helper
  private draftSaveTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  saveDraftDebounced(taskId: string, annotation: AnnotationRequest, delayMs: number = 1000): void {
    // Clear existing timeout for this task
    const existingTimeout = this.draftSaveTimeouts.get(taskId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      try {
        await this.saveAnnotationDraft(taskId, annotation);
        console.log(`Draft saved for task ${taskId}`);
      } catch (error) {
        console.error(`Failed to save draft for task ${taskId}:`, error);
      } finally {
        this.draftSaveTimeouts.delete(taskId);
      }
    }, delayMs);

    this.draftSaveTimeouts.set(taskId, timeout);
  }

  // Generate idempotency key for submit
  generateIdempotencyKey(taskId: string): string {
    return `${taskId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const taskService = new TaskService();
