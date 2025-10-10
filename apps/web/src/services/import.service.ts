import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export interface ImportJobResult {
  jobId: string;
  filename: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errorReportPath: string | null;
  status: 'completed' | 'failed';
}

export interface ImportJob {
  id: string;
  filename: string;
  uploaded_by: string | null;
  status: 'processing' | 'completed' | 'failed';
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  error_report_path: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export class ImportService {
  private apiUrl = `${API_BASE_URL}`;

  async uploadCSV(file: File, userId?: string): Promise<ImportJobResult> {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {
      'Content-Type': 'multipart/form-data',
    };

    if (userId) {
      headers['x-user-id'] = userId;
    }

    const response = await axios.post(`${this.apiUrl}/import/jobs`, formData, {
      headers,
    });

    return response.data.data;
  }

  async getImportJob(jobId: string): Promise<ImportJob> {
    const response = await axios.get(`${this.apiUrl}/import/jobs/${jobId}`);
    return response.data.data;
  }

  async downloadErrorReport(jobId: string): Promise<Blob> {
    const response = await axios.get(`${this.apiUrl}/import/jobs/${jobId}/errors`, {
      responseType: 'blob',
    });
    return response.data;
  }
}

export const importService = new ImportService();
