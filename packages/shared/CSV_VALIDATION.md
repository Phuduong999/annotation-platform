# CSV Import Validation

Comprehensive CSV validation for importing scan data with Zod schemas and ontology enums.

## Features

### Ontology Enums

Four classification categories defined in `src/ontology.ts`:

#### 1. ScanType
- `content_moderation`
- `safety_check`
- `quality_assessment`
- `compliance_review`
- `authenticity_verification`
- `sentiment_analysis`

#### 2. Feedback
- `positive`, `negative`, `neutral`
- `flagged`, `approved`, `rejected`
- `escalated`, `pending_review`

#### 3. Result
- `pass`, `fail`, `warning`, `error`
- `inconclusive`, `requires_human_review`
- `auto_approved`, `auto_rejected`

#### 4. Reaction
- `accept`, `reject`, `challenge`, `appeal`
- `confirm`, `dispute`, `acknowledge`, `ignore`

## CSV Schema

Required fields (all mandatory):

| Field | Type | Validation |
|-------|------|------------|
| `date` | ISO-8601 | Must be valid ISO-8601 format (e.g., `2024-01-01T12:00:00Z`) |
| `request_id` | string | Unique identifier, min 1 char |
| `user_id` | string | Min 1 char |
| `team_id` | string | Min 1 char |
| `type` | enum | Must be one of ScanType enum values |
| `user_input` | URL | Must be valid HTTP(S) URL pointing to an image |
| `raw_ai_output` | JSON string | Must be valid JSON string |

## Usage

### Parse and Validate CSV String

```typescript
import { parseAndValidateCsv } from '@monorepo/shared';

const csvContent = `date,request_id,user_id,team_id,type,user_input,raw_ai_output
2024-01-01T12:00:00Z,req-1,user-1,team-1,content_moderation,https://example.com/img.jpg,{"result":"safe"}`;

const result = parseAndValidateCsv(csvContent);

if (result.success) {
  console.log(`✓ ${result.validCount} valid rows`);
  result.validRows.forEach(row => {
    // Process valid row
  });
} else {
  console.error(`✗ ${result.errorCount} errors found`);
  result.errors.forEach(error => {
    console.error(`Line ${error.line}: ${error.message}`);
  });
}
```

### Validate Pre-parsed Data (Streaming)

```typescript
import { validateCsvData } from '@monorepo/shared';

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
];

const result = validateCsvData(data, 2); // Start line number for error reporting
```

### Validate Headers Only

```typescript
import { validateHeaders } from '@monorepo/shared';

const headers = ['date', 'request_id', 'user_id', 'team_id', 'type', 'user_input', 'raw_ai_output'];
const errors = validateHeaders(headers);

if (errors.length > 0) {
  console.error('Invalid headers:', errors);
}
```

### Format Error Messages

```typescript
import { formatValidationErrors } from '@monorepo/shared';

const formatted = formatValidationErrors(result.errors);
console.log(formatted);
// Output:
// Line 2: [INVALID_DATE_FORMAT] Field: date Must be a valid ISO-8601 date (Got: "2024-01-01")
// Line 3: [INVALID_ENUM_VALUE] Field: type Invalid enum value (Got: "bad_type") (Expected: content_moderation, safety_check, ...)
```

## Error Codes

All validation errors include clear error codes:

- `INVALID_HEADER` - Missing or extra CSV headers
- `MISSING_REQUIRED_FIELD` - Required field is empty or missing
- `INVALID_DATE_FORMAT` - Date not in ISO-8601 format
- `INVALID_ENUM_VALUE` - Value not in allowed enum values
- `INVALID_JSON` - JSON string cannot be parsed
- `INVALID_URL` - URL is malformed or not an image URL
- `DUPLICATE_REQUEST_ID` - request_id appears multiple times
- `INVALID_FIELD_VALUE` - Generic field validation error

## Validation Results

The `ValidationResult` object contains:

```typescript
{
  success: boolean;        // True if no errors
  errors: ValidationError[]; // Array of all errors
  validRows: CsvRow[];     // Successfully validated rows
  totalRows: number;       // Total rows processed
  validCount: number;      // Number of valid rows
  errorCount: number;      // Number of errors
}
```

Each `ValidationError` includes:

```typescript
{
  code: ValidationErrorCode;  // Error code enum
  line: number;               // Line number in CSV (1-based)
  field?: string;             // Field name with error
  value?: string;             // Invalid value provided
  message: string;            // Human-readable error message
  expected?: string;          // Expected values (for enums)
}
```

## Examples

### Valid CSV
```csv
date,request_id,user_id,team_id,type,user_input,raw_ai_output
2024-01-01T12:00:00Z,req-1,user-1,team-1,content_moderation,https://example.com/image.jpg,{"result":"safe"}
2024-01-02T13:00:00Z,req-2,user-2,team-2,safety_check,https://example.com/photo.png,{"status":"ok"}
```

### ISO-8601 Date Formats Accepted
- `2024-01-01T12:00:00Z` (UTC)
- `2024-01-01T12:00:00.123Z` (with milliseconds)
- `2024-01-01T12:00:00+05:30` (with timezone offset)
- `2024-12-31T23:59:59-08:00` (negative offset)

### Image URL Formats Accepted
- `https://example.com/image.jpg` (with extension)
- `https://cdn.example.com/images/pic.png`
- `https://example.com/api/image/123` (path contains 'image')
- `https://example.com/file?image=true` (query param)

## Testing

Comprehensive test suite with 29 test cases covering:

✓ Header validation (missing, invalid, case-insensitive)
✓ Date format validation (ISO-8601)
✓ Enum value validation
✓ JSON parsing
✓ URL validation (protocol, image detection)
✓ Duplicate detection
✓ Empty field detection
✓ Line-by-line error reporting
✓ Edge cases

Run tests:
```bash
cd packages/shared
pnpm test
```

## Type Safety

All schemas and types are fully typed with TypeScript:

```typescript
import type { CsvRow, ValidationError, ValidationResult } from '@monorepo/shared';
import type { ScanType, Feedback, Result, Reaction } from '@monorepo/shared';
```

## Performance

- Streaming-friendly: `validateCsvData()` can process chunks
- Line-by-line validation continues after errors
- Duplicate detection uses Set for O(1) lookups
- All validation uses Zod for optimized schema checking
