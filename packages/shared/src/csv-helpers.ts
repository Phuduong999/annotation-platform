import { z } from 'zod';
import {
  CsvRowSchema,
  REQUIRED_CSV_HEADERS,
  ValidationError,
  ValidationErrorCode,
  ValidationResult,
  type CsvRow,
  type CsvHeader,
} from './csv-validation.js';
import { ScanTypeEnum } from './ontology.js';

/**
 * CSV Parsing and Validation Helpers
 */

/**
 * Validates CSV headers against required headers
 */
export function validateHeaders(headers: string[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());
  
  // Check for missing required headers
  for (const required of REQUIRED_CSV_HEADERS) {
    if (!normalizedHeaders.includes(required)) {
      errors.push({
        code: ValidationErrorCode.INVALID_HEADER,
        line: 1,
        field: required,
        message: `Missing required header: ${required}`,
        expected: REQUIRED_CSV_HEADERS.join(', '),
      });
    }
  }
  
  // Check for extra/invalid headers
  for (const header of normalizedHeaders) {
    if (!REQUIRED_CSV_HEADERS.includes(header as CsvHeader)) {
      errors.push({
        code: ValidationErrorCode.INVALID_HEADER,
        line: 1,
        field: header,
        message: `Invalid header: ${header}`,
        expected: REQUIRED_CSV_HEADERS.join(', '),
      });
    }
  }
  
  return errors;
}

/**
 * Validates a single CSV row
 */
export function validateRow(
  row: Record<string, string>,
  lineNumber: number,
  seenRequestIds: Set<string>
): { errors: ValidationError[]; validRow?: CsvRow } {
  const errors: ValidationError[] = [];
  
  try {
    // Check for duplicate request_id
    if (row.request_id && seenRequestIds.has(row.request_id)) {
      errors.push({
        code: ValidationErrorCode.DUPLICATE_REQUEST_ID,
        line: lineNumber,
        field: 'request_id',
        value: row.request_id,
        message: `Duplicate request_id: ${row.request_id}`,
      });
    }
    
    // Validate with Zod schema
    const validatedRow = CsvRowSchema.parse(row);
    
    if (row.request_id) {
      seenRequestIds.add(row.request_id);
    }
    
    return { errors, validRow: validatedRow };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Convert Zod errors to our ValidationError format
      for (const issue of error.errors) {
        const field = issue.path[0]?.toString();
        const value = field ? row[field] : undefined;
        
        let code = ValidationErrorCode.INVALID_FIELD_VALUE;
        
        // Determine specific error code based on the issue
        if (issue.message.includes('ISO-8601')) {
          code = ValidationErrorCode.INVALID_DATE_FORMAT;
        } else if (issue.message.includes('JSON')) {
          code = ValidationErrorCode.INVALID_JSON;
        } else if (issue.message.includes('URL')) {
          code = ValidationErrorCode.INVALID_URL;
        } else if (issue.message.includes('Invalid enum value')) {
          code = ValidationErrorCode.INVALID_ENUM_VALUE;
        } else if (issue.code === 'invalid_type' || issue.message.includes('Required')) {
          code = ValidationErrorCode.MISSING_REQUIRED_FIELD;
        }
        
        // Add expected values for enum errors
        let expected: string | undefined;
        if (code === ValidationErrorCode.INVALID_ENUM_VALUE && field === 'type') {
          expected = ScanTypeEnum.options.join(', ');
        }
        
        errors.push({
          code,
          line: lineNumber,
          field,
          value,
          message: issue.message,
          expected,
        });
      }
    } else {
      errors.push({
        code: ValidationErrorCode.INVALID_FIELD_VALUE,
        line: lineNumber,
        message: error instanceof Error ? error.message : 'Unknown validation error',
      });
    }
    
    return { errors, validRow: undefined };
  }
}

/**
 * Parses and validates CSV data (string format)
 */
export function parseAndValidateCsv(csvContent: string): ValidationResult {
  const lines = csvContent.trim().split('\n');
  const errors: ValidationError[] = [];
  const validRows: CsvRow[] = [];
  const seenRequestIds = new Set<string>();
  
  if (lines.length === 0) {
    return {
      success: false,
      errors: [
        {
          code: ValidationErrorCode.INVALID_HEADER,
          line: 1,
          message: 'CSV file is empty',
        },
      ],
      validRows: [],
      totalRows: 0,
      validCount: 0,
      errorCount: 1,
    };
  }
  
  // Parse headers
  const headerLine = lines[0].trim();
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());
  
  // Validate headers
  const headerErrors = validateHeaders(headers);
  errors.push(...headerErrors);
  
  // If headers are invalid, stop processing
  if (headerErrors.length > 0) {
    return {
      success: false,
      errors,
      validRows: [],
      totalRows: lines.length - 1,
      validCount: 0,
      errorCount: errors.length,
    };
  }
  
  // Process data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    const values = line.split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    const { errors: rowErrors, validRow } = validateRow(row, i + 1, seenRequestIds);
    
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    }
    
    if (validRow) {
      validRows.push(validRow);
    }
  }
  
  return {
    success: errors.length === 0,
    errors,
    validRows,
    totalRows: lines.length - 1,
    validCount: validRows.length,
    errorCount: errors.length,
  };
}

/**
 * Validates CSV data from array of objects (for streaming or pre-parsed data)
 */
export function validateCsvData(
  data: Record<string, string>[],
  startLine: number = 2
): ValidationResult {
  const errors: ValidationError[] = [];
  const validRows: CsvRow[] = [];
  const seenRequestIds = new Set<string>();
  
  for (let i = 0; i < data.length; i++) {
    const { errors: rowErrors, validRow } = validateRow(
      data[i],
      startLine + i,
      seenRequestIds
    );
    
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    }
    
    if (validRow) {
      validRows.push(validRow);
    }
  }
  
  return {
    success: errors.length === 0,
    errors,
    validRows,
    totalRows: data.length,
    validCount: validRows.length,
    errorCount: errors.length,
  };
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .map((error) => {
      const parts = [`Line ${error.line}: [${error.code}]`];
      
      if (error.field) {
        parts.push(`Field: ${error.field}`);
      }
      
      parts.push(error.message);
      
      if (error.value) {
        parts.push(`(Got: "${error.value}")`);
      }
      
      if (error.expected) {
        parts.push(`(Expected: ${error.expected})`);
      }
      
      return parts.join(' ');
    })
    .join('\n');
}
