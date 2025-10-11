import axios from 'axios';
import { 
  Snapshot, 
  CreateSnapshotRequest, 
  SnapshotFilter,
  ExportManifest 
} from '../types/snapshot.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export class SnapshotService {
  private apiUrl = `${API_BASE_URL}`;

  async createSnapshot(request: CreateSnapshotRequest): Promise<Snapshot> {
    const response = await axios.post(`${this.apiUrl}/snapshots`, request);
    return response.data.data;
  }

  async getSnapshots(filters?: SnapshotFilter): Promise<{
    snapshots: Snapshot[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.status) params.append('status', filters.status);
      if (filters.is_published !== undefined) params.append('is_published', filters.is_published.toString());
      if (filters.is_archived !== undefined) params.append('is_archived', filters.is_archived.toString());
      if (filters.created_by) params.append('created_by', filters.created_by);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
    }

    const response = await axios.get(`${this.apiUrl}/snapshots?${params.toString()}`);
    return response.data.data;
  }

  async getSnapshot(id: string): Promise<Snapshot> {
    const response = await axios.get(`${this.apiUrl}/snapshots/${id}`);
    return response.data.data;
  }

  async updateSnapshot(id: string, updates: Partial<Pick<Snapshot, 'name' | 'description'>>): Promise<Snapshot> {
    const response = await axios.put(`${this.apiUrl}/snapshots/${id}`, updates);
    return response.data.data;
  }

  async deleteSnapshot(id: string): Promise<void> {
    await axios.delete(`${this.apiUrl}/snapshots/${id}`);
  }

  async publishSnapshot(id: string): Promise<Snapshot> {
    const response = await axios.put(`${this.apiUrl}/snapshots/${id}/publish`);
    return response.data.data;
  }

  async archiveSnapshot(id: string): Promise<Snapshot> {
    const response = await axios.put(`${this.apiUrl}/snapshots/${id}/archive`);
    return response.data.data;
  }

  async getSnapshotManifest(id: string): Promise<ExportManifest> {
    const response = await axios.get(`${this.apiUrl}/snapshots/${id}/manifest`);
    return response.data.data;
  }

  async getSnapshotItems(
    id: string, 
    split?: 'train' | 'validation' | 'test',
    limit?: number,
    offset?: number
  ): Promise<{
    items: any[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const params = new URLSearchParams();
    if (split) params.append('split', split);
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());

    const response = await axios.get(`${this.apiUrl}/snapshots/${id}/items?${params.toString()}`);
    return response.data.data;
  }

  async getSnapshotStats(id: string): Promise<{
    total_items: number;
    split_counts: {
      train: number;
      validation: number;
      test: number;
    };
    scan_type_distribution: Record<'meal' | 'label' | 'front_label' | 'screenshot' | 'others', number>;
    quality_metrics?: {
      avg_confidence: number;
      completeness: number;
    };
  }> {
    const response = await axios.get(`${this.apiUrl}/snapshots/${id}/stats`);
    return response.data.data;
  }
}

export const snapshotService = new SnapshotService();