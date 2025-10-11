import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { ImportService } from '../../apps/api/src/services/import.service.js';
import { ValidationErrorCode } from '../../packages/shared/src/csv-validation.js';

type QueryResult = { rows: any[]; rowCount?: number };

class MockPool {
  importRows: Array<{
    import_job_id: string;
    line_number: number;
    status: 'valid' | 'invalid';
    error_code?: string | null;
    error_detail?: string | null;
    row_data: Record<string, string>;
  }> = [];
  feedbackEvents: Array<{
    request_id: string;
    reaction: string | null;
    category: string | null;
    note: string | null;
    source: string;
    metadata: any;
  }> = [];
  jobId = 'job-test-1';
  lastUpdate: { text: string; params: any[] } | null = null;

  async query(text: string, params: any[] = []): Promise<QueryResult> {
    if (text.startsWith('INSERT INTO import_jobs')) {
      return { rows: [{ id: this.jobId }] };
    }

    if (text.startsWith('UPDATE import_jobs')) {
      this.lastUpdate = { text, params };
      return { rows: [], rowCount: 1 };
    }

    if (text.startsWith('INSERT INTO import_rows')) {
      this.importRows.push({
        import_job_id: params[0],
        line_number: params[1],
        status: params[2],
        error_code: params[3] || undefined,
        error_detail: params[4] || undefined,
        row_data: JSON.parse(params[5]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (text.startsWith('INSERT INTO feedback_events')) {
      const metadata = params[5] ? JSON.parse(params[5]) : null;
      const event = {
        request_id: params[0],
        reaction: params[1],
        category: params[2],
        note: params[3],
        source: params[4],
        metadata,
      };
      this.feedbackEvents.push(event);
      return { rows: [event], rowCount: 1 };
    }

    if (text.startsWith('SELECT line_number')) {
      const rows = this.importRows
        .filter((row) => row.status === 'invalid' && row.import_job_id === params[0])
        .map((row) => ({
          line_number: row.line_number,
          error_code: row.error_code,
          error_detail: row.error_detail,
          row_data: row.row_data,
        }));
      return { rows };
    }

    return { rows: [], rowCount: 0 };
  }
}

describe('ImportService.processJSONImport', () => {
  let pool: MockPool;
  let service: ImportService;

  beforeEach(() => {
    pool = new MockPool();
    service = new ImportService(pool as any);
  });

  it('imports a valid JSON record with feedback extras', async () => {
    const record = {
      date: '2024-10-09T12:00:00',
      request_id: 'REQ-100',
      user_id: 'user-1',
      team_id: 'team-1',
      type: 'meal',
      user_input: 'https://example.com/image.jpg',
      raw_ai_output: { calories: 120 },
      reaction: 'like',
      feedback_category: 'taste',
      feedback_note: 'Looks good',
    };

    const result = await service.processJSONImport([record], {
      filename: 'json-sample.json',
      uploadedBy: 'tester',
    });

    assert.equal(result.totalRows, 1);
    assert.equal(result.validRows, 1);
    assert.equal(result.invalidRows, 0);
    assert.equal(result.filename, 'json-sample.json');
    assert.equal(result.status, 'completed');

    assert.equal(pool.importRows.length, 1);
    const storedRow = pool.importRows[0];
    assert.equal(storedRow.status, 'valid');
    assert.equal(storedRow.row_data.request_id, 'REQ-100');
    assert.equal(storedRow.row_data.type, 'meal');
    assert.ok(storedRow.row_data.date.endsWith('Z'));
    assert.equal(storedRow.row_data.raw_ai_output, JSON.stringify({ calories: 120 }));
    assert.equal(storedRow.row_data.reaction, 'like');
    assert.equal(storedRow.row_data.feedback_category, 'taste');
    assert.equal(storedRow.row_data.feedback_note, 'Looks good');

    assert.equal(pool.feedbackEvents.length, 1);
    const event = pool.feedbackEvents[0];
    assert.equal(event.request_id, 'REQ-100');
    assert.equal(event.reaction, 'like');
    assert.equal(event.category, 'taste');
    assert.equal(event.note, 'Looks good');
    assert.equal(event.source, 'import_json');
    assert.deepEqual(event.metadata, {
      import_job_id: pool.jobId,
      import_line_number: 1,
    });
  });

  it('marks invalid type with INVALID_ENUM_VALUE', async () => {
    const record = {
      date: '2024-10-09T12:00:00Z',
      request_id: 'REQ-200',
      user_id: 'user-2',
      team_id: 'team-2',
      type: 'invalid_type',
      user_input: 'https://example.com/image.jpg',
      raw_ai_output: '{}',
    };

    const result = await service.processJSONImport([record]);

    assert.equal(result.totalRows, 1);
    assert.equal(result.validRows, 0);
    assert.equal(result.invalidRows, 1);
    assert.equal(pool.importRows.length, 1);
    assert.equal(pool.importRows[0].status, 'invalid');
    assert.equal(pool.importRows[0].error_code, ValidationErrorCode.INVALID_ENUM_VALUE);
  });

  it('marks invalid raw_ai_output with INVALID_JSON', async () => {
    const record = {
      date: '2024-10-09T12:00:00Z',
      request_id: 'REQ-300',
      user_id: 'user-3',
      team_id: 'team-3',
      type: 'label',
      user_input: 'https://example.com/image.jpg',
      raw_ai_output: '{invalid}',
    };

    const result = await service.processJSONImport([record]);

    assert.equal(result.totalRows, 1);
    assert.equal(result.invalidRows, 1);
    assert.equal(pool.importRows[0].error_code, ValidationErrorCode.INVALID_JSON);
  });

  it('detects duplicate request_id within a job', async () => {
    const records = [
      {
        date: '2024-10-09T12:00:00Z',
        request_id: 'REQ-400',
        user_id: 'user-4',
        team_id: 'team-4',
        type: 'others',
        user_input: 'https://example.com/image.jpg',
        raw_ai_output: '{}',
      },
      {
        date: '2024-10-09T12:05:00Z',
        request_id: 'REQ-400',
        user_id: 'user-5',
        team_id: 'team-5',
        type: 'meal',
        user_input: 'https://example.com/another.jpg',
        raw_ai_output: '{}',
      },
    ];

    const result = await service.processJSONImport(records);

    assert.equal(result.totalRows, 2);
    assert.equal(result.validRows, 1);
    assert.equal(result.invalidRows, 1);
    assert.equal(pool.importRows.length, 2);
    const duplicateRow = pool.importRows.find((row) => row.status === 'invalid');
    assert.ok(duplicateRow);
    assert.equal(duplicateRow!.error_code, ValidationErrorCode.DUPLICATE_REQUEST_ID);
  });
});
