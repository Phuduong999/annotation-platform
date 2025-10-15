import axios from 'axios';
import { 
  Export, 
  CreateExportRequest, 
  ExportFormat,
  DataSplit 
} from '../types/snapshot.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export interface ExportFilter {
  snapshot_id?: string;
  format?: ExportFormat;
  split?: DataSplit;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  created_by?: string;
  from_date?: string;
  to_date?: string;
}

export class ExportService {
  private apiUrl = `${API_BASE_URL}`;

  async createExport(request: CreateExportRequest): Promise<Export> {
    const response = await axios.post(`${this.apiUrl}/exports`, request);
    return response.data.data;
  }

  async getExports(filters?: ExportFilter): Promise<{
    exports: Export[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.snapshot_id) params.append('snapshot_id', filters.snapshot_id);
      if (filters.format) params.append('format', filters.format);
      if (filters.status) params.append('status', filters.status);
      if (filters.created_by) params.append('created_by', filters.created_by);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
    }

    const response = await axios.get(`${this.apiUrl}/exports/list?${params.toString()}`);
    return response.data.data;
  }

  async getExport(id: string): Promise<Export> {
    const response = await axios.get(`${this.apiUrl}/exports/${id}`);
    return response.data.data;
  }

  async deleteExport(id: string): Promise<void> {
    await axios.delete(`${this.apiUrl}/exports/${id}`);
  }

  async downloadExport(id: string): Promise<Blob> {
    const response = await axios.get(`${this.apiUrl}/exports/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async getExportProgress(id: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
    progress_percentage?: number;
    estimated_completion_time?: string;
    error_message?: string;
  }> {
    const response = await axios.get(`${this.apiUrl}/exports/${id}/progress`);
    return response.data.data;
  }

  async extendExportExpiry(id: string, hours?: number): Promise<Export> {
    const body = hours ? { hours } : {};
    const response = await axios.put(`${this.apiUrl}/exports/${id}/extend`, body);
    return response.data.data;
  }

  // Helper method to trigger download in browser
  async downloadExportFile(exportItem: Export): Promise<void> {
    if (!exportItem.download_url) {
      throw new Error('Export download URL not available');
    }

    const blob = await this.downloadExport(exportItem.id);
    
    // Create blob URL and trigger download
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename based on export details
    const extension = this.getFileExtension(exportItem.format);
    const splitSuffix = exportItem.split ? `_${exportItem.split}` : '';
    const compressionSuffix = exportItem.is_compressed ? '.gz' : '';
    
    link.download = `export_${exportItem.id}${splitSuffix}.${extension}${compressionSuffix}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up blob URL
    window.URL.revokeObjectURL(url);
  }

  private getFileExtension(format: ExportFormat): string {
    switch (format) {
      case 'csv': return 'csv';
      case 'json': return 'json';
      case 'jsonl': return 'jsonl';
      case 'xlsx': return 'xlsx';
      default: return 'txt';
    }
  }

  // Direct export download methods (connects to /exports endpoint)
  async downloadDirectExport(snapshotId: string, format: ExportFormat, split: DataSplit = 'all'): Promise<void> {
    try {
      const params = new URLSearchParams({
        snapshot: snapshotId,
        format: format,
        split: split
      });

      const response = await axios.get(`${this.apiUrl}/exports?${params.toString()}`, {
        responseType: 'blob',
      });

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers['content-disposition'];
      let filename = `export-${snapshotId}-${split}.${this.getFileExtension(format)}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      // Create blob URL and trigger download
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }

  // Stream export download (for large datasets)
  async downloadStreamExport(snapshotId: string, format: ExportFormat, split: DataSplit = 'all'): Promise<void> {
    try {
      const params = new URLSearchParams({
        snapshot: snapshotId,
        format: format,
        split: split
      });

      const response = await axios.get(`${this.apiUrl}/exports/stream?${params.toString()}`, {
        responseType: 'blob',
      });

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers['content-disposition'];
      let filename = `export-${snapshotId}-${split}.${this.getFileExtension(format)}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      // Create blob URL and trigger download
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }
}

export const exportService = new ExportService();