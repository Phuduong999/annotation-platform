# CSV Import API

RESTful API for importing and validating CSV files with streaming validation and per-row error reporting.

## Endpoints

### POST /import/jobs

Upload and process a CSV file for import.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Headers:
  - `x-user-id` (optional): User identifier for tracking

**Form Data:**
- `file`: CSV file (max 10MB)

**CSV Format:**
Required columns (case-insensitive):
- `date` - ISO-8601 format (e.g., 2024-01-01T12:00:00Z)
- `request_id` - Unique identifier
- `user_id` - User identifier
- `team_id` - Team identifier
- `type` - Scan type enum (see ontology)
- `user_input` - HTTP(S) URL to image
- `raw_ai_output` - JSON string

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "filename": "import.csv",
    "totalRows": 100,
    "validRows": 95,
    "invalidRows": 5,
    "errorReportPath": "/reports/errors_uuid.csv",
    "status": "completed"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "No file uploaded",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### GET /import/jobs/:jobId

Get import job details.

**Request:**
- Method: `GET`
- Path Parameters:
  - `jobId`: UUID of the import job

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "filename": "import.csv",
    "uploaded_by": "test-user",
    "status": "completed",
    "total_rows": 100,
    "valid_rows": 95,
    "invalid_rows": 5,
    "error_report_path": "/reports/errors_uuid.csv",
    "started_at": "2024-01-01T12:00:00.000Z",
    "completed_at": "2024-01-01T12:00:05.000Z",
    "created_at": "2024-01-01T12:00:00.000Z",
    "updated_at": "2024-01-01T12:00:05.000Z"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Import job not found",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### GET /import/jobs/:jobId/errors

Download error report CSV for an import job.

**Request:**
- Method: `GET`
- Path Parameters:
  - `jobId`: UUID of the import job

**Response (200 OK):**
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="errors_uuid.csv"`

CSV format:
```csv
line_number,error_code,error_detail,original_data
2,INVALID_DATE_FORMAT,Must be a valid ISO-8601 date,"{...}"
3,INVALID_ENUM_VALUE,Invalid enum value. Expected: content_moderation...,"{...}"
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": "No errors found for this import job",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Database Schema

### import_jobs

Tracks import job metadata and summary statistics.

```sql
CREATE TABLE import_jobs (
    id UUID PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    uploaded_by VARCHAR(255),
    status VARCHAR(50) NOT NULL, -- 'processing' | 'completed' | 'failed'
    total_rows INTEGER NOT NULL DEFAULT 0,
    valid_rows INTEGER NOT NULL DEFAULT 0,
    invalid_rows INTEGER NOT NULL DEFAULT 0,
    error_report_path VARCHAR(500),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);
```

### import_rows

Stores per-row validation results with error details.

```sql
CREATE TABLE import_rows (
    id UUID PRIMARY KEY,
    import_job_id UUID REFERENCES import_jobs(id),
    line_number INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'valid' | 'invalid'
    error_code VARCHAR(100),
    error_detail TEXT,
    row_data JSONB,
    task_id UUID,
    created_at TIMESTAMP WITH TIME ZONE
);
```

### tasks

Task stubs created only for valid rows.

```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    import_row_id UUID REFERENCES import_rows(id),
    request_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    team_id VARCHAR(255) NOT NULL,
    scan_type VARCHAR(100) NOT NULL,
    user_input TEXT NOT NULL,
    raw_ai_output JSONB,
    scan_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);
```

## Features

### Streaming Validation

- CSV files are processed using streaming parser
- Row-by-row validation without loading entire file into memory
- Supports large files (up to 10MB by default)

### Error Reporting

- Per-row error tracking with line numbers
- Clear error codes (INVALID_DATE_FORMAT, INVALID_ENUM_VALUE, etc.)
- Detailed error messages
- Downloadable CSV error report

### Task Creation

- Tasks are **only** created for valid rows
- Invalid rows are stored but no tasks are created
- Each task has a reference to its import row

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_HEADER` | Missing or extra CSV headers |
| `MISSING_REQUIRED_FIELD` | Required field is empty |
| `INVALID_DATE_FORMAT` | Date not in ISO-8601 format |
| `INVALID_ENUM_VALUE` | Value not in allowed enum |
| `INVALID_JSON` | JSON string cannot be parsed |
| `INVALID_URL` | URL is malformed or not an image URL |
| `DUPLICATE_REQUEST_ID` | request_id appears multiple times |

## Usage Examples

### cURL

**Upload CSV:**
```bash
curl -X POST http://localhost:4000/import/jobs \
  -H "x-user-id: user-123" \
  -F "file=@data.csv"
```

**Get job details:**
```bash
curl http://localhost:4000/import/jobs/{jobId}
```

**Download error report:**
```bash
curl http://localhost:4000/import/jobs/{jobId}/errors \
  -o errors.csv
```

### JavaScript/TypeScript

```typescript
// Upload CSV
const formData = new FormData();
formData.append('file', file);

const response = await fetch('http://localhost:4000/import/jobs', {
  method: 'POST',
  headers: {
    'x-user-id': 'user-123',
  },
  body: formData,
});

const result = await response.json();
console.log(`Job ID: ${result.data.jobId}`);
console.log(`Valid: ${result.data.validRows}, Invalid: ${result.data.invalidRows}`);

// Download error report if there are errors
if (result.data.invalidRows > 0) {
  const errorResponse = await fetch(
    `http://localhost:4000/import/jobs/${result.data.jobId}/errors`
  );
  const errorCsv = await errorResponse.text();
  console.log(errorCsv);
}
```

### Test Script

Use the provided test script:

```bash
./test-import.sh
```

This will:
1. Upload the test CSV file
2. Display job summary
3. Fetch job details
4. Download and preview error report

## Sample CSV

Valid CSV example:
```csv
date,request_id,user_id,team_id,type,user_input,raw_ai_output
2024-01-01T12:00:00Z,req-001,user-123,team-456,content_moderation,https://example.com/img.jpg,{"result":"safe"}
2024-01-02T13:00:00Z,req-002,user-124,team-456,safety_check,https://example.com/img.png,{"status":"approved"}
```

## Validation Rules

### Date Field
- Must be ISO-8601 format
- Accepted formats:
  - `2024-01-01T12:00:00Z`
  - `2024-01-01T12:00:00.123Z`
  - `2024-01-01T12:00:00+05:30`

### Request ID
- Must be unique across all rows in the CSV
- Cannot be empty

### Type Field (Enum)
Valid values:
- `content_moderation`
- `safety_check`
- `quality_assessment`
- `compliance_review`
- `authenticity_verification`
- `sentiment_analysis`

### User Input (URL)
- Must be valid HTTP or HTTPS URL
- Must point to an image (checked by extension, path, or query parameter)

### Raw AI Output
- Must be valid JSON string
- Can contain any JSON structure

## Performance

- Streaming parser: Handles large files efficiently
- Async row processing: Non-blocking validation
- Batch database inserts: Optimized for performance
- Connection pooling: Reuses database connections

## Error Handling

- File upload errors: 400 Bad Request
- Validation errors: Stored per row, job still completes
- Database errors: 500 Internal Server Error
- Job not found: 404 Not Found

## Security Considerations

- File size limit: 10MB (configurable)
- File type validation: Must be CSV
- SQL injection protection: Parameterized queries
- CORS enabled: Configure for production
- Rate limiting: Should be added for production
