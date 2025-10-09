import { Pool } from 'pg';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import {
  validateRow,
  validateHeaders,
  ValidationError,
  ValidationErrorCode,
  type CsvRow,
} from '@monorepo/shared';

export interface ImportJobResult {
  jobId: string;
  filename: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errorReportPath: string | null;
  status: 'completed' | 'failed';
}

export interface ImportRowRecord {
  lineNumber: number;
  status: 'valid' | 'invalid';
  errorCode?: string;
  errorDetail?: string;
  rowData: Record<string, string>;
  taskId?: string;
}

export class ImportService {
  constructor(private pool: Pool) {}

  /**
   * Process CSV file stream and create import job
   */
  async processCSVImport(
    fileStream: Readable,
    filename: string,
    uploadedBy?: string
  ): Promise<ImportJobResult> {
    // Create import job
    const jobId = await this.createImportJob(filename, uploadedBy);

    try {
      const result = await this.streamCSVValidation(fileStream, jobId);

      // Generate error report if there are errors
      let errorReportPath: string | null = null;
      if (result.invalidRows > 0) {
        errorReportPath = await this.generateErrorReport(jobId);
      }

      // Update job status
      await this.updateImportJob(jobId, {
        status: 'completed',
        totalRows: result.totalRows,
        validRows: result.validRows,
        invalidRows: result.invalidRows,
        errorReportPath,
        completedAt: new Date(),
      });

      return {
        jobId,
        filename,
        totalRows: result.totalRows,
        validRows: result.validRows,
        invalidRows: result.invalidRows,
        errorReportPath,
        status: 'completed',
      };
    } catch (error) {
      // Mark job as failed
      await this.updateImportJob(jobId, {
        status: 'failed',
        completedAt: new Date(),
      });
      throw error;
    }
  }

  /**
   * Create import job record
   */
  private async createImportJob(filename: string, uploadedBy?: string): Promise<string> {
    const result = await this.pool.query(
      `INSERT INTO import_jobs (filename, uploaded_by, status)
       VALUES ($1, $2, 'processing')
       RETURNING id`,
      [filename, uploadedBy]
    );
    return result.rows[0].id;
  }

  /**
   * Update import job with results
   */
  private async updateImportJob(
    jobId: string,
    updates: {
      status?: string;
      totalRows?: number;
      validRows?: number;
      invalidRows?: number;
      errorReportPath?: string | null;
      completedAt?: Date;
    }
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.totalRows !== undefined) {
      fields.push(`total_rows = $${paramIndex++}`);
      values.push(updates.totalRows);
    }
    if (updates.validRows !== undefined) {
      fields.push(`valid_rows = $${paramIndex++}`);
      values.push(updates.validRows);
    }
    if (updates.invalidRows !== undefined) {
      fields.push(`invalid_rows = $${paramIndex++}`);
      values.push(updates.invalidRows);
    }
    if (updates.errorReportPath !== undefined) {
      fields.push(`error_report_path = $${paramIndex++}`);
      values.push(updates.errorReportPath);
    }
    if (updates.completedAt !== undefined) {
      fields.push(`completed_at = $${paramIndex++}`);
      values.push(updates.completedAt);
    }

    values.push(jobId);

    await this.pool.query(
      `UPDATE import_jobs SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
  }

  /**
   * Stream CSV validation with row-by-row processing
   */
  private async streamCSVValidation(
    stream: Readable,
    jobId: string
  ): Promise<{ totalRows: number; validRows: number; invalidRows: number }> {
    return new Promise((resolve, reject) => {
      let totalRows = 0;
      let validRows = 0;
      let invalidRows = 0;
      let headers: string[] = [];
      let headerErrors: ValidationError[] = [];
      const seenRequestIds = new Set<string>();

      const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
        relax_column_count: true,
      });

      // Get headers from first row
      parser.once('readable', () => {
        const record = parser.read();
        if (record) {
          headers = Object.keys(record).map((h) => h.toLowerCase());
          headerErrors = validateHeaders(headers);

          if (headerErrors.length > 0) {
            // Store header errors
            this.storeImportRow(jobId, {
              lineNumber: 1,
              status: 'invalid',
              errorCode: ValidationErrorCode.INVALID_HEADER,
              errorDetail: headerErrors.map((e) => e.message).join('; '),
              rowData: {},
            }).catch(console.error);

            invalidRows++;
          }

          // Process the first record
          this.processRow(record, 2, jobId, seenRequestIds).then((isValid) => {
            totalRows++;
            if (isValid) validRows++;
            else invalidRows++;
          });
        }
      });

      // Process subsequent rows
      parser.on('data', (record: Record<string, string>) => {
        if (totalRows === 0) return; // Skip if first row (already processed)

        const lineNumber = totalRows + 2; // +1 for header, +1 for 0-based index
        totalRows++;

        this.processRow(record, lineNumber, jobId, seenRequestIds)
          .then((isValid) => {
            if (isValid) validRows++;
            else invalidRows++;
          })
          .catch((error) => {
            console.error(`Error processing row ${lineNumber}:`, error);
            invalidRows++;
          });
      });

      parser.on('error', (error) => {
        reject(error);
      });

      parser.on('end', () => {
        // Wait a bit for async operations to complete
        setTimeout(() => {
          resolve({ totalRows, validRows, invalidRows });
        }, 100);
      });

      stream.pipe(parser);
    });
  }

  /**
   * Process and validate a single row
   */
  private async processRow(
    record: Record<string, string>,
    lineNumber: number,
    jobId: string,
    seenRequestIds: Set<string>
  ): Promise<boolean> {
    const { errors, validRow } = validateRow(record, lineNumber, seenRequestIds);

    if (errors.length > 0) {
      // Store invalid row
      await this.storeImportRow(jobId, {
        lineNumber,
        status: 'invalid',
        errorCode: errors[0].code,
        errorDetail: errors.map((e) => e.message).join('; '),
        rowData: record,
      });
      return false;
    }

    if (validRow) {
      // Create task stub
      const taskId = await this.createTaskStub(validRow);

      // Store valid row
      await this.storeImportRow(jobId, {
        lineNumber,
        status: 'valid',
        rowData: record,
        taskId,
      });
      return true;
    }

    return false;
  }

  /**
   * Store import row record
   */
  private async storeImportRow(jobId: string, row: ImportRowRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO import_rows 
       (import_job_id, line_number, status, error_code, error_detail, row_data, task_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        jobId,
        row.lineNumber,
        row.status,
        row.errorCode || null,
        row.errorDetail || null,
        JSON.stringify(row.rowData),
        row.taskId || null,
      ]
    );
  }

  /**
   * Create task stub for valid row
   */
  private async createTaskStub(row: CsvRow): Promise<string> {
    const result = await this.pool.query(
      `INSERT INTO tasks 
       (request_id, user_id, team_id, scan_type, user_input, raw_ai_output, scan_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING id`,
      [
        row.request_id,
        row.user_id,
        row.team_id,
        row.type,
        row.user_input,
        JSON.parse(row.raw_ai_output),
        new Date(row.date),
      ]
    );
    return result.rows[0].id;
  }

  /**
   * Generate error report CSV
   */
  private async generateErrorReport(jobId: string): Promise<string> {
    const result = await this.pool.query(
      `SELECT line_number, error_code, error_detail, row_data
       FROM import_rows
       WHERE import_job_id = $1 AND status = 'invalid'
       ORDER BY line_number`,
      [jobId]
    );

    const errorRows = result.rows;
    if (errorRows.length === 0) {
      return '';
    }

    // Build CSV content
    const csvLines: string[] = [];
    csvLines.push('line_number,error_code,error_detail,original_data');

    for (const row of errorRows) {
      const originalData = JSON.stringify(row.row_data).replace(/"/g, '""');
      csvLines.push(
        `${row.line_number},"${row.error_code}","${row.error_detail}","${originalData}"`
      );
    }

    const errorReportPath = `/reports/errors_${jobId}.csv`;

    // In production, save to file system or S3
    // For now, we'll store the path reference
    // You would implement actual file storage here

    return errorReportPath;
  }

  /**
   * Get error report CSV content
   */
  async getErrorReportContent(jobId: string): Promise<string> {
    const result = await this.pool.query(
      `SELECT line_number, error_code, error_detail, row_data
       FROM import_rows
       WHERE import_job_id = $1 AND status = 'invalid'
       ORDER BY line_number`,
      [jobId]
    );

    const errorRows = result.rows;
    if (errorRows.length === 0) {
      return '';
    }

    const csvLines: string[] = [];
    csvLines.push('line_number,error_code,error_detail,original_data');

    for (const row of errorRows) {
      const originalData = JSON.stringify(row.row_data).replace(/"/g, '""');
      csvLines.push(
        `${row.line_number},"${row.error_code}","${row.error_detail}","${originalData}"`
      );
    }

    return csvLines.join('\n');
  }

  /**
   * Get import job details
   */
  async getImportJob(jobId: string) {
    const result = await this.pool.query(
      `SELECT * FROM import_jobs WHERE id = $1`,
      [jobId]
    );
    return result.rows[0];
  }
}
