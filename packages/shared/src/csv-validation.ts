import { z } from 'zod';
import { ScanTypeEnum } from './ontology.js';

/**
 * CSV Import Validation Schema
 * Validates required fields for CSV data import
 */

// Custom refinement for ISO-8601 date validation
const iso8601DateSchema = z.string().refine(
  (val) => {
    // ISO-8601 format validation
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
    if (!iso8601Regex.test(val)) return false;
    
    // Check if it's a valid date
    const date = new Date(val);
    return !isNaN(date.getTime());
  },
  {
    message: 'Must be a valid ISO-8601 date (e.g., 2024-01-01T12:00:00Z)',
  }
);

// Custom refinement for image URL validation
const imageUrlSchema = z.string().refine(
  (val) => {
    try {
      const url = new URL(val);
      // Must be http or https
      if (!['http:', 'https:'].includes(url.protocol)) {
        return false;
      }
      // Check for common image extensions
      const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url.pathname);
      const hasImageParam = url.search.includes('image') || url.search.includes('img');
      
      return hasImageExtension || hasImageParam || url.pathname.includes('/image/');
    } catch {
      return false;
    }
  },
  {
    message: 'Must be a valid HTTP(S) URL pointing to an image',
  }
);

// Custom refinement for JSON string validation
const jsonStringSchema = z.string().refine(
  (val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  },
  {
    message: 'Must be a valid JSON string',
  }
);

// CSV Row Schema
export const CsvRowSchema = z.object({
  date: iso8601DateSchema.describe('ISO-8601 formatted date'),
  request_id: z.string().min(1).describe('Unique request identifier'),
  user_id: z.string().min(1).describe('User identifier'),
  team_id: z.string().min(1).describe('Team identifier'),
  type: ScanTypeEnum.describe('Scan type from ontology'),
  user_input: imageUrlSchema.describe('URL to image'),
  raw_ai_output: jsonStringSchema.describe('JSON string of AI output'),
});

export type CsvRow = z.infer<typeof CsvRowSchema>;

// Expected CSV headers
export const REQUIRED_CSV_HEADERS = [
  'date',
  'request_id',
  'user_id',
  'team_id',
  'type',
  'user_input',
  'raw_ai_output',
] as const;

export type CsvHeader = (typeof REQUIRED_CSV_HEADERS)[number];

// Validation error codes
export enum ValidationErrorCode {
  INVALID_HEADER = 'INVALID_HEADER',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_DATE_FORMAT = 'INVALID_DATE_FORMAT',
  INVALID_ENUM_VALUE = 'INVALID_ENUM_VALUE',
  INVALID_JSON = 'INVALID_JSON',
  INVALID_URL = 'INVALID_URL',
  DUPLICATE_REQUEST_ID = 'DUPLICATE_REQUEST_ID',
  INVALID_FIELD_VALUE = 'INVALID_FIELD_VALUE',
}

// Validation error detail
export interface ValidationError {
  code: ValidationErrorCode;
  line: number;
  field?: string;
  value?: string;
  message: string;
  expected?: string;
}

// Validation result
export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
  validRows: CsvRow[];
  totalRows: number;
  validCount: number;
  errorCount: number;
}
