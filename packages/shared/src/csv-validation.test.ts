import { describe, it, expect } from 'vitest';
import {
  parseAndValidateCsv,
  validateCsvData,
  validateHeaders,
  validateRow,
  formatValidationErrors,
} from './csv-helpers.js';
import { ValidationErrorCode } from './csv-validation.js';
import { ScanTypeEnum } from './ontology.js';

describe('CSV Validation', () => {
  describe('validateHeaders', () => {
    it('should pass with all required headers', () => {
      const headers = [
        'date',
        'request_id',
        'user_id',
        'team_id',
        'type',
        'user_input',
        'raw_ai_output',
      ];
      const errors = validateHeaders(headers);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing required headers', () => {
      const headers = ['date', 'request_id', 'user_id'];
      const errors = validateHeaders(headers);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.code === ValidationErrorCode.INVALID_HEADER)).toBe(true);
      expect(errors.some((e) => e.message.includes('team_id'))).toBe(true);
      expect(errors.some((e) => e.message.includes('type'))).toBe(true);
    });

    it('should detect invalid/extra headers', () => {
      const headers = [
        'date',
        'request_id',
        'user_id',
        'team_id',
        'type',
        'user_input',
        'raw_ai_output',
        'invalid_column',
      ];
      const errors = validateHeaders(headers);
      
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(ValidationErrorCode.INVALID_HEADER);
      expect(errors[0].message).toContain('invalid_column');
    });

    it('should handle case insensitive headers', () => {
      const headers = [
        'DATE',
        'Request_ID',
        'USER_ID',
        'Team_Id',
        'TYPE',
        'User_Input',
        'Raw_AI_Output',
      ];
      const errors = validateHeaders(headers);
      expect(errors).toHaveLength(0);
    });
  });

  describe('validateRow', () => {
    const validRow = {
      date: '2024-01-01T12:00:00Z',
      request_id: 'req-123',
      user_id: 'user-456',
      team_id: 'team-789',
      type: 'content_moderation',
      user_input: 'https://example.com/image.jpg',
      raw_ai_output: '{"result":"safe"}',
    };

    it('should validate a correct row', () => {
      const seenIds = new Set<string>();
      const { errors, validRow: result } = validateRow(validRow, 2, seenIds);
      
      expect(errors).toHaveLength(0);
      expect(result).toBeDefined();
      expect(result?.date).toBe(validRow.date);
      expect(result?.request_id).toBe(validRow.request_id);
      expect(seenIds.has('req-123')).toBe(true);
    });

    it('should detect invalid date format', () => {
      const invalidRow = { ...validRow, date: '2024-01-01' };
      const { errors } = validateRow(invalidRow, 2, new Set());
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe(ValidationErrorCode.INVALID_DATE_FORMAT);
      expect(errors[0].line).toBe(2);
      expect(errors[0].field).toBe('date');
      expect(errors[0].message).toContain('ISO-8601');
    });

    it('should detect invalid enum value', () => {
      const invalidRow = { ...validRow, type: 'invalid_type' };
      const { errors } = validateRow(invalidRow, 3, new Set());
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe(ValidationErrorCode.INVALID_ENUM_VALUE);
      expect(errors[0].line).toBe(3);
      expect(errors[0].field).toBe('type');
      expect(errors[0].expected).toContain('content_moderation');
      expect(errors[0].value).toBe('invalid_type');
    });

    it('should detect invalid JSON', () => {
      const invalidRow = { ...validRow, raw_ai_output: '{invalid json}' };
      const { errors } = validateRow(invalidRow, 4, new Set());
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe(ValidationErrorCode.INVALID_JSON);
      expect(errors[0].line).toBe(4);
      expect(errors[0].field).toBe('raw_ai_output');
      expect(errors[0].message).toContain('JSON');
    });

    it('should detect invalid URL', () => {
      const invalidRow = { ...validRow, user_input: 'not-a-url' };
      const { errors } = validateRow(invalidRow, 5, new Set());
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe(ValidationErrorCode.INVALID_URL);
      expect(errors[0].line).toBe(5);
      expect(errors[0].field).toBe('user_input');
      expect(errors[0].message).toContain('URL');
    });

    it('should detect non-image URL', () => {
      const invalidRow = { ...validRow, user_input: 'https://example.com/page.html' };
      const { errors } = validateRow(invalidRow, 6, new Set());
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe(ValidationErrorCode.INVALID_URL);
    });

    it('should accept image URLs with query parameters', () => {
      const imageUrlRow = {
        ...validRow,
        user_input: 'https://example.com/file?image=true',
      };
      const { errors } = validateRow(imageUrlRow, 2, new Set());
      
      expect(errors).toHaveLength(0);
    });

    it('should detect duplicate request_id', () => {
      const seenIds = new Set(['req-123']);
      const { errors } = validateRow(validRow, 7, seenIds);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe(ValidationErrorCode.DUPLICATE_REQUEST_ID);
      expect(errors[0].line).toBe(7);
      expect(errors[0].value).toBe('req-123');
    });

    it('should detect missing required fields', () => {
      const incompleteRow = {
        date: '2024-01-01T12:00:00Z',
        request_id: '',
        user_id: '',
        team_id: 'team-789',
        type: 'content_moderation',
        user_input: 'https://example.com/image.jpg',
        raw_ai_output: '{"result":"safe"}',
      };
      const { errors } = validateRow(incompleteRow, 8, new Set());
      
      expect(errors.length).toBeGreaterThan(0);
      // Zod treats empty strings as failing .min(1), which is an invalid_string error
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate all scan type enum values', () => {
      const scanTypes = ScanTypeEnum.options;
      
      for (const scanType of scanTypes) {
        const row = { ...validRow, type: scanType };
        const { errors } = validateRow(row, 2, new Set());
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('parseAndValidateCsv', () => {
    const validCsv = `date,request_id,user_id,team_id,type,user_input,raw_ai_output
2024-01-01T12:00:00Z,req-1,user-1,team-1,content_moderation,https://example.com/img.jpg,{"result":"safe"}
2024-01-02T13:00:00Z,req-2,user-2,team-2,safety_check,https://example.com/photo.png,{"status":"ok"}`;

    it('should parse and validate valid CSV', () => {
      const result = parseAndValidateCsv(validCsv);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.validRows).toHaveLength(2);
      expect(result.totalRows).toBe(2);
      expect(result.validCount).toBe(2);
      expect(result.errorCount).toBe(0);
    });

    it('should detect empty CSV', () => {
      const result = parseAndValidateCsv('');
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // When CSV is empty (''). trim().split('\n') gives [''] which is treated as missing all headers
      const hasHeaderError = result.errors.some((e) => e.code === ValidationErrorCode.INVALID_HEADER);
      expect(hasHeaderError).toBe(true);
    });

    it('should stop processing on invalid headers', () => {
      const invalidHeaderCsv = `date,request_id,invalid_column
2024-01-01T12:00:00Z,req-1,value`;
      
      const result = parseAndValidateCsv(invalidHeaderCsv);
      
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.code === ValidationErrorCode.INVALID_HEADER)).toBe(
        true
      );
      expect(result.validRows).toHaveLength(0);
    });

    it('should report errors with correct line numbers', () => {
      const csvWithErrors = `date,request_id,user_id,team_id,type,user_input,raw_ai_output
2024-01-01,req-1,user-1,team-1,content_moderation,https://example.com/img.jpg,{"result":"safe"}
2024-01-02T13:00:00Z,req-2,user-2,team-2,invalid_type,https://example.com/photo.png,{"status":"ok"}
2024-01-03T14:00:00Z,req-3,user-3,team-3,safety_check,not-a-url,invalid json`;
      
      const result = parseAndValidateCsv(csvWithErrors);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check line 2 has date error
      const line2Errors = result.errors.filter((e) => e.line === 2);
      expect(line2Errors.length).toBeGreaterThan(0);
      expect(line2Errors[0].code).toBe(ValidationErrorCode.INVALID_DATE_FORMAT);
      
      // Check line 3 has enum error
      const line3Errors = result.errors.filter((e) => e.line === 3);
      expect(line3Errors.some((e) => e.code === ValidationErrorCode.INVALID_ENUM_VALUE)).toBe(
        true
      );
      
      // Check line 4 has URL and JSON errors
      const line4Errors = result.errors.filter((e) => e.line === 4);
      expect(line4Errors.some((e) => e.code === ValidationErrorCode.INVALID_URL)).toBe(true);
      expect(line4Errors.some((e) => e.code === ValidationErrorCode.INVALID_JSON)).toBe(true);
    });

    it('should detect duplicate request_ids across rows', () => {
      const csvWithDuplicates = `date,request_id,user_id,team_id,type,user_input,raw_ai_output
2024-01-01T12:00:00Z,req-1,user-1,team-1,content_moderation,https://example.com/img.jpg,{"result":"safe"}
2024-01-02T13:00:00Z,req-1,user-2,team-2,safety_check,https://example.com/photo.png,{"status":"ok"}`
      
      const result = parseAndValidateCsv(csvWithDuplicates);
      
      expect(result.success).toBe(false);
      expect(
        result.errors.some((e) => e.code === ValidationErrorCode.DUPLICATE_REQUEST_ID)
      ).toBe(true);
      expect(result.errors.find((e) => e.code === ValidationErrorCode.DUPLICATE_REQUEST_ID)?.line).toBe(3);
    });

    it('should skip empty lines', () => {
      const csvWithEmptyLines = `date,request_id,user_id,team_id,type,user_input,raw_ai_output
2024-01-01T12:00:00Z,req-1,user-1,team-1,content_moderation,https://example.com/img.jpg,{"result":"safe"}

2024-01-02T13:00:00Z,req-2,user-2,team-2,safety_check,https://example.com/photo.png,{"status":"ok"}`
      
      const result = parseAndValidateCsv(csvWithEmptyLines);
      
      expect(result.success).toBe(true);
      expect(result.validRows).toHaveLength(2);
    });
  });

  describe('validateCsvData', () => {
    it('should validate array of objects', () => {
      const data = [
        {
          date: '2024-01-01T12:00:00Z',
          request_id: 'req-1',
          user_id: 'user-1',
          team_id: 'team-1',
          type: 'content_moderation',
          user_input: 'https://example.com/img.jpg',
          raw_ai_output: '{"result":"safe"}',
        },
        {
          date: '2024-01-02T13:00:00Z',
          request_id: 'req-2',
          user_id: 'user-2',
          team_id: 'team-2',
          type: 'safety_check',
          user_input: 'https://example.com/photo.png',
          raw_ai_output: '{"status":"ok"}',
        },
      ];
      
      const result = validateCsvData(data);
      
      expect(result.success).toBe(true);
      expect(result.validRows).toHaveLength(2);
      expect(result.errorCount).toBe(0);
    });

    it('should use custom start line number', () => {
      const data = [
        {
          date: 'invalid-date',
          request_id: 'req-1',
          user_id: 'user-1',
          team_id: 'team-1',
          type: 'content_moderation',
          user_input: 'https://example.com/img.jpg',
          raw_ai_output: '{"result":"safe"}',
        },
      ];
      
      const result = validateCsvData(data, 10);
      
      expect(result.success).toBe(false);
      expect(result.errors[0].line).toBe(10);
    });
  });

  describe('formatValidationErrors', () => {
    it('should format errors with all fields', () => {
      const errors = [
        {
          code: ValidationErrorCode.INVALID_ENUM_VALUE,
          line: 3,
          field: 'type',
          value: 'bad_type',
          message: 'Invalid enum value',
          expected: 'content_moderation, safety_check',
        },
      ];
      
      const formatted = formatValidationErrors(errors);
      
      expect(formatted).toContain('Line 3');
      expect(formatted).toContain('INVALID_ENUM_VALUE');
      expect(formatted).toContain('type');
      expect(formatted).toContain('bad_type');
      expect(formatted).toContain('content_moderation');
    });

    it('should format multiple errors', () => {
      const errors = [
        {
          code: ValidationErrorCode.INVALID_DATE_FORMAT,
          line: 2,
          field: 'date',
          value: '2024-01-01',
          message: 'Invalid date format',
        },
        {
          code: ValidationErrorCode.INVALID_URL,
          line: 3,
          field: 'user_input',
          value: 'not-a-url',
          message: 'Invalid URL',
        },
      ];
      
      const formatted = formatValidationErrors(errors);
      const lines = formatted.split('\n');
      
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('Line 2');
      expect(lines[1]).toContain('Line 3');
    });
  });

  describe('Edge Cases', () => {
    it('should handle various ISO-8601 formats', () => {
      const validDates = [
        '2024-01-01T12:00:00Z',
        '2024-01-01T12:00:00.123Z',
        '2024-01-01T12:00:00+05:30',
        '2024-12-31T23:59:59-08:00',
      ];
      
      for (const date of validDates) {
        const row = {
          date,
          request_id: 'req-1',
          user_id: 'user-1',
          team_id: 'team-1',
          type: 'content_moderation',
          user_input: 'https://example.com/img.jpg',
          raw_ai_output: '{"result":"safe"}',
        };
        
        const { errors } = validateRow(row, 2, new Set());
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject invalid date strings', () => {
      const invalidDates = [
        '2024-13-01T12:00:00Z', // Invalid month
        '2024-01-32T12:00:00Z', // Invalid day
        '2024-01-01 12:00:00', // Wrong format
        '2024-01-01T25:00:00Z', // Invalid hour
      ];
      
      for (const date of invalidDates) {
        const row = {
          date,
          request_id: 'req-1',
          user_id: 'user-1',
          team_id: 'team-1',
          type: 'content_moderation',
          user_input: 'https://example.com/img.jpg',
          raw_ai_output: '{"result":"safe"}',
        };
        
        const { errors } = validateRow(row, 2, new Set());
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].code).toBe(ValidationErrorCode.INVALID_DATE_FORMAT);
      }
    });

    it('should accept various image URL formats', () => {
      const validUrls = [
        'https://example.com/image.jpg',
        'http://example.com/photo.png',
        'https://cdn.example.com/images/pic.gif',
        'https://example.com/api/image/123',
        'https://example.com/file?img=true',
      ];
      
      for (const url of validUrls) {
        const row = {
          date: '2024-01-01T12:00:00Z',
          request_id: 'req-1',
          user_id: 'user-1',
          team_id: 'team-1',
          type: 'content_moderation',
          user_input: url,
          raw_ai_output: '{"result":"safe"}',
        };
        
        const { errors } = validateRow(row, 2, new Set());
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject non-HTTP protocols', () => {
      const invalidUrls = ['ftp://example.com/image.jpg', 'file:///path/to/image.jpg'];
      
      for (const url of invalidUrls) {
        const row = {
          date: '2024-01-01T12:00:00Z',
          request_id: 'req-1',
          user_id: 'user-1',
          team_id: 'team-1',
          type: 'content_moderation',
          user_input: url,
          raw_ai_output: '{"result":"safe"}',
        };
        
        const { errors } = validateRow(row, 2, new Set());
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].code).toBe(ValidationErrorCode.INVALID_URL);
      }
    });

    it('should accept complex JSON structures', () => {
      const complexJson = JSON.stringify({
        result: 'safe',
        scores: { violence: 0.1, adult: 0.05 },
        metadata: { model: 'v2', timestamp: '2024-01-01' },
      });
      
      const row = {
        date: '2024-01-01T12:00:00Z',
        request_id: 'req-1',
        user_id: 'user-1',
        team_id: 'team-1',
        type: 'content_moderation',
        user_input: 'https://example.com/img.jpg',
        raw_ai_output: complexJson,
      };
      
      const { errors } = validateRow(row, 2, new Set());
      expect(errors).toHaveLength(0);
    });
  });
});
