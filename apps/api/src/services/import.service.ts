import { Pool } from 'pg';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import * as XLSX from 'xlsx';
import {
  validateRow,
  validateHeaders,
  ValidationError,
  ValidationErrorCode,
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
}

/**
 * Import Service
 * 
 * Processes CSV/XLSX file uploads for the /import/jobs endpoint.
 * 
 * STRATEGY: Option 1 - ImportService only creates import_rows
 * - Task creation is handled separately by TaskService via /tasks/create
 * - This prevents duplicate task creation and allows link validation before task creation
 * 
 * Key Features:
 * - Converts XLSX/XLS files to CSV format
 * - Validates CSV data using shared schema from @monorepo/shared
 * - Enforces ScanTypeEnum values: ['meal','label','front_label','screenshot','others']
 * - Creates import_rows records for all rows (valid/invalid)
 * - NO task creation (handled separately by TaskService)
 * - Generates error reports for invalid rows
 * 
 * CSV Schema:
 * - date: ISO-8601 date string
 * - request_id: unique identifier
 * - user_id: user identifier  
 * - team_id: team identifier
 * - type: scan type enum
 * - user_input: image URL
 * - raw_ai_output: JSON string
 * 
 * Workflow:
 * 1. POST /import/jobs - validates and creates import_rows
 * 2. POST /tasks/create - creates tasks only for valid rows with link_status='ok'
 */
export class ImportService {
  constructor(private pool: Pool) {}

  /**
   * Convert XLSX stream to CSV stream
   */
  private async convertXLSXtoCSVStream(fileStream: Readable): Promise<Readable> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      fileStream.on('data', (chunk) => chunks.push(chunk));
      fileStream.on('error', reject);
      fileStream.on('end', () => {
        try {
          // Parse XLSX
          const buffer = Buffer.concat(chunks);
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          
          // Get first sheet
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
            throw new Error('XLSX file has no sheets');
          }
          
          const worksheet = workbook.Sheets[sheetName];
          
          // Convert to CSV
          const csv = XLSX.utils.sheet_to_csv(worksheet);
          
          // Create readable stream from CSV string
          const csvStream = Readable.from([csv]);
          resolve(csvStream);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Process CSV/XLSX file stream and create import job
   */
  async processCSVImport(
    fileStream: Readable,
    filename: string,
    uploadedBy?: string,
    isXLSX: boolean = false
  ): Promise<ImportJobResult> {
    // Create import job
    const jobId = await this.createImportJob(filename, uploadedBy);

    try {
      // Convert XLSX to CSV if needed
      let processStream = fileStream;
      if (isXLSX) {
        processStream = await this.convertXLSXtoCSVStream(fileStream);
      }

      const result = await this.streamCSVValidation(processStream, jobId);

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

  async processJSONImport(
    records: unknown[],
    options: { filename?: string; uploadedBy?: string } = {}
  ): Promise<ImportJobResult> {
    if (!Array.isArray(records)) {
      throw new Error('Invalid payload: expected an array of records');
    }

    const filename = options.filename || 'json-import.json';
    const uploadedBy = options.uploadedBy;
    const jobId = await this.createImportJob(filename, uploadedBy);

    let totalRows = 0;
    let validRows = 0;
    let invalidRows = 0;
    const seenRequestIds = new Set<string>();

    try {
      for (let index = 0; index < records.length; index++) {
        totalRows++;
        const lineNumber = index + 1;
        const record = records[index];

        if (!record || typeof record !== 'object') {
          invalidRows++;
          await this.storeImportRow(jobId, {
            lineNumber,
            status: 'invalid',
            errorCode: ValidationErrorCode.INVALID_FIELD_VALUE,
            errorDetail: 'Record must be an object',
            rowData: {
              raw: typeof record === 'string' ? record : JSON.stringify(record ?? null),
            },
          });
          continue;
        }

        const { normalizedRow, extras } = this.normalizeJsonRecord(record as Record<string, unknown>);

        const requestId = normalizedRow.request_id?.trim();
        if (requestId) {
          if (seenRequestIds.has(requestId)) {
            invalidRows++;
            await this.storeImportRow(jobId, {
              lineNumber,
              status: 'invalid',
              errorCode: ValidationErrorCode.DUPLICATE_REQUEST_ID,
              errorDetail: `Duplicate request_id: ${requestId}`,
              rowData: normalizedRow,
            });
            continue;
          }

          seenRequestIds.add(requestId);
        }

        const { errors, validRow } = validateRow(normalizedRow, lineNumber, new Set<string>());

        if (errors.length > 0 || !validRow) {
          invalidRows++;
          const primaryError = errors[0];
          await this.storeImportRow(jobId, {
            lineNumber,
            status: 'invalid',
            errorCode: primaryError?.code || ValidationErrorCode.INVALID_FIELD_VALUE,
            errorDetail: primaryError?.message || 'Invalid record',
            rowData: normalizedRow,
          });
          continue;
        }

        const rowData: Record<string, string> = {
          ...validRow,
          raw_ai_output: this.stringifyJson(validRow.raw_ai_output),
        };

        if (extras.reaction) {
          rowData.reaction = extras.reaction;
        }
        if (extras.feedbackCategory) {
          rowData.feedback_category = extras.feedbackCategory;
        }
        if (extras.feedbackNote) {
          rowData.feedback_note = extras.feedbackNote;
        }

        if (extras.labelAnnotation) {
          if (extras.labelAnnotation.scanType) {
            rowData.label_scan_type = extras.labelAnnotation.scanType;
          }
          if (extras.labelAnnotation.resultReturn) {
            rowData.label_result_return = extras.labelAnnotation.resultReturn;
          }
          if (extras.labelAnnotation.feedbackCorrection) {
            rowData.label_feedback_correction = JSON.stringify(extras.labelAnnotation.feedbackCorrection);
          }
          if (extras.labelAnnotation.note) {
            rowData.label_note = extras.labelAnnotation.note;
          }
          if (extras.labelAnnotation.labelSkip) {
            rowData.label_skip = extras.labelAnnotation.labelSkip;
          }
        }

        await this.storeImportRow(jobId, {
          lineNumber,
          status: 'valid',
          rowData,
        });
        validRows++;

        if (extras.reaction || extras.feedbackCategory || extras.feedbackNote) {
          await this.insertFeedbackEventFromImport(validRow.request_id, extras, jobId, lineNumber);
        }
      }

      let errorReportPath: string | null = null;
      if (invalidRows > 0) {
        errorReportPath = await this.generateErrorReport(jobId);
      }

      await this.updateImportJob(jobId, {
        status: 'completed',
        totalRows,
        validRows,
        invalidRows,
        errorReportPath,
        completedAt: new Date(),
      });

      return {
        jobId,
        filename,
        totalRows,
        validRows,
        invalidRows,
        errorReportPath,
        status: 'completed',
      };
    } catch (error) {
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
   * Only creates import_rows - tasks are created later via /tasks/create
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
      // Store valid row (no task creation here - handled by TaskService later)
      await this.storeImportRow(jobId, {
        lineNumber,
        status: 'valid',
        rowData: record,
      });
      return true;
    }

    return false;
  }

  /**
   * Store import row record
   * Only stores row data - no task references (tasks created separately)
   */
  private async storeImportRow(jobId: string, row: ImportRowRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO import_rows 
       (import_job_id, line_number, status, error_code, error_detail, row_data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        jobId,
        row.lineNumber,
        row.status,
        row.errorCode || null,
        row.errorDetail || null,
        JSON.stringify(row.rowData),
      ]
    );
  }

  private normalizeJsonRecord(record: Record<string, unknown>): {
    normalizedRow: Record<string, string>;
    extras: {
      reaction?: 'like' | 'dislike' | 'neutral';
      feedbackCategory?: string;
      feedbackNote?: string;
      labelAnnotation?: {
        scanType?: string;
        resultReturn?: string;
        feedbackCorrection?: string[];
        note?: string;
        labelSkip?: string;
      };
    };
  } {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (typeof key !== 'string') continue;
      const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_').replace(/\?/g, '');
      normalized[cleanKey] = value;
    }

    const row: Record<string, string> = {
      date: '',
      request_id: '',
      user_id: '',
      team_id: '',
      type: '',
      user_input: '',
      raw_ai_output: '',
      user_email: '',
      user_full_name: '',
      user_log: '',
      raw_user_log: '',
      is_logged: '',
      edit_category: '',
      ai_output_log: '',
    };

    // Date - accept multiple formats
    const dateValue = normalized.date ?? normalized.scan_date ?? normalized.created_at;
    if (typeof dateValue === 'string' || dateValue instanceof Date || typeof dateValue === 'number') {
      const parsedDate = new Date(dateValue);
      if (!Number.isNaN(parsedDate.getTime())) {
        row.date = parsedDate.toISOString();
      } else if (typeof dateValue === 'string') {
        row.date = dateValue;
      }
    }

    // Request ID
    const requestIdValue = normalized.request_id ?? normalized.req_id;
    if (requestIdValue !== undefined && requestIdValue !== null) {
      row.request_id = String(requestIdValue).trim();
    }

    // User ID
    const userIdValue = normalized.user_id ?? normalized.user;
    if (userIdValue !== undefined && userIdValue !== null) {
      row.user_id = String(userIdValue).trim();
    }

    // Team ID
    const teamIdValue = normalized.team_id ?? normalized.team ?? normalized.user_current_team;
    if (teamIdValue !== undefined && teamIdValue !== null) {
      row.team_id = String(teamIdValue).trim();
    }

    // Type
    const typeValue = normalized.type ?? normalized.scan_type;
    if (typeof typeValue === 'string') {
      row.type = typeValue.trim().toLowerCase();
    }

    // User Input (image URL)
    const userInputValue = normalized.user_input ?? normalized.image_url ?? normalized.asset_url;
    if (userInputValue !== undefined && userInputValue !== null) {
      row.user_input = String(userInputValue).trim();
    }

    // Raw AI Output
    const rawAiValue = normalized.raw_ai_output ?? normalized.ai_output ?? normalized.inference;
    row.raw_ai_output = this.prepareRawAiOutput(rawAiValue);

    // User Email
    const userEmailValue = normalized.user_email ?? normalized.email;
    if (userEmailValue !== undefined && userEmailValue !== null) {
      row.user_email = String(userEmailValue).trim();
    }

    // User Full Name
    const userFullNameValue = normalized.user_full_name ?? normalized.full_name ?? normalized.name;
    if (userFullNameValue !== undefined && userFullNameValue !== null) {
      row.user_full_name = String(userFullNameValue).trim();
    }

    // User Log
    const userLogValue = normalized.user_log ?? normalized.log ?? normalized.notes;
    if (userLogValue !== undefined && userLogValue !== null) {
      row.user_log = String(userLogValue).trim();
    }

    // Raw User Log
    const rawUserLogValue = normalized.raw_user_log ?? normalized.raw_log;
    if (rawUserLogValue !== undefined && rawUserLogValue !== null) {
      row.raw_user_log = String(rawUserLogValue).trim();
    }

    // Is Logged
    const isLoggedValue = normalized.is_logged ?? normalized.logged;
    if (isLoggedValue !== undefined && isLoggedValue !== null) {
      const strValue = String(isLoggedValue).trim().toLowerCase();
      row.is_logged = strValue === 'yes' || strValue === 'true' || strValue === '1' ? 'true' : 'false';
    }

    // Edit Category
    const editCategoryValue = normalized.edit_category ?? normalized.category;
    if (editCategoryValue !== undefined && editCategoryValue !== null) {
      row.edit_category = String(editCategoryValue).trim();
    }

    // AI Output Log (alternative format)
    const aiOutputLogValue = normalized.ai_output_log ?? normalized.output_log;
    if (aiOutputLogValue !== undefined && aiOutputLogValue !== null) {
      row.ai_output_log = this.prepareRawAiOutput(aiOutputLogValue);
    }

    const extras = {
      reaction: this.normalizeReaction(normalized.reaction ?? normalized.feedback_reaction),
      feedbackCategory: this.normalizeString(normalized.feedback_category),
      feedbackNote: this.normalizeString(normalized.feedback_note ?? normalized.feedback),
      labelAnnotation: this.extractLabelAnnotation(normalized),
    };

    return { normalizedRow: row, extras };
  }

  private extractLabelAnnotation(normalized: Record<string, unknown>): {
    scanType?: string;
    resultReturn?: string;
    feedbackCorrection?: string[];
    note?: string;
    labelSkip?: string;
  } | undefined {
    const scanType = this.normalizeString(normalized.scan_type);
    const resultReturn = this.normalizeString(normalized.result_return);
    const feedbackCorrection = this.normalizeFeedbackCorrection(normalized.feedback_correction);
    const note = this.normalizeString(normalized.reason ?? normalized.note);
    const labelSkip = this.normalizeString(normalized.label_skip);

    if (!scanType && !resultReturn && !feedbackCorrection && !note && !labelSkip) {
      return undefined;
    }

    return {
      scanType,
      resultReturn,
      feedbackCorrection,
      note,
      labelSkip,
    };
  }

  private normalizeFeedbackCorrection(value: unknown): string[] | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed || trimmed.toLowerCase() === 'no feedback') {
        return undefined;
      }
      return trimmed.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    }
    
    if (Array.isArray(value)) {
      const filtered = value
        .map((v) => (typeof v === 'string' ? v.trim() : String(v)))
        .filter((s) => s.length > 0 && s.toLowerCase() !== 'no feedback');
      return filtered.length > 0 ? filtered : undefined;
    }

    return undefined;
  }

  private prepareRawAiOutput(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return '';
      }

      try {
        const parsed = JSON.parse(trimmed);
        return JSON.stringify(parsed);
      } catch {
        return trimmed;
      }
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '';
      }
    }

    return String(value);
  }

  private stringifyJson(value: string): string {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed);
    } catch {
      return value;
    }
  }

  private normalizeReaction(value: unknown): 'like' | 'dislike' | 'neutral' | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === 'like' || normalized === 'dislike' || normalized === 'neutral') {
      return normalized;
    }

    return undefined;
  }

  private normalizeString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private async insertFeedbackEventFromImport(
    requestId: string,
    extras: {
      reaction?: 'like' | 'dislike' | 'neutral';
      feedbackCategory?: string;
      feedbackNote?: string;
    },
    jobId: string,
    lineNumber: number
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO feedback_events (request_id, reaction, category, note, source, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (request_id) WHERE user_event_id IS NULL DO NOTHING`,
        [
          requestId,
          extras.reaction || null,
          extras.feedbackCategory || null,
          extras.feedbackNote || null,
          'import_json',
          JSON.stringify({ import_job_id: jobId, import_line_number: lineNumber }),
        ]
      );
    } catch (error) {
      console.error('Failed to insert feedback event from import:', error);
    }
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
