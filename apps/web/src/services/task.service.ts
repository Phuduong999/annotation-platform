import axios from 'axios';
import { Task, TaskStats, TaskFilter, TaskAnnotation } from '../types/task.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export class TaskService {
  private apiUrl = `${API_BASE_URL}`;

  async getTasks(filter?: TaskFilter): Promise<Task[]> {
    const params = new URLSearchParams();
    
    if (filter) {
      if (filter.status) params.append('status', filter.status);
      if (filter.assigned_to_me) params.append('assigned_to_me', 'true');
      if (filter.team_id) params.append('team_id', filter.team_id);
      if (filter.type) params.append('type', filter.type);
      if (filter.date_from) params.append('date_from', filter.date_from);
      if (filter.date_to) params.append('date_to', filter.date_to);
    }

    const response = await axios.get(`${this.apiUrl}/tasks?${params.toString()}`);
    // Handle new response format with pagination
    if (response.data.data?.tasks) {
      return response.data.data.tasks;
    }
    // Fallback to old format if needed
    return response.data.data || [];
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

  async startTask(taskId: string): Promise<Task> {
    const response = await axios.put(`${this.apiUrl}/tasks/${taskId}/start`);
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
}

export const taskService = new TaskService();