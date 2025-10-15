# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a pnpm-based monorepo for an annotation/labeling platform that processes scan data with AI-powered workflow automation. The system includes CSV import validation, task assignment, annotation workflow with draft/final states, analytics, alerting, and export capabilities.

## Monorepo Structure

```
apps/
  api/         - Fastify REST API (port 4000)
  web/         - React + Vite + Mantine UI (port 5173)
  worker/      - BullMQ background worker with Redis
packages/
  shared/      - Shared TypeScript types, Zod schemas, CSV validation
migrations/    - PostgreSQL migration files (numbered sequentially)
tests/         - Integration test scripts for API validation
```

## Essential Commands

### Development

```bash
# Start all apps in parallel (API + Web)
pnpm dev

# Start specific app
pnpm -F @monorepo/api dev
pnpm -F @monorepo/web dev
pnpm -F @monorepo/worker dev

# Start Docker services (PostgreSQL + Redis)
docker-compose up -d
```

### Building

```bash
# Build all packages (shared must build first, then apps)
pnpm build

# Build specific package
pnpm -F @monorepo/shared build
pnpm -F @monorepo/api build
```

### Testing & Quality

```bash
# Run all linters
pnpm lint

# Type check all packages
pnpm type-check

# Run shared package tests (Vitest)
cd packages/shared && pnpm test

# Run integration tests
cd tests && ./test-import-api.sh
```

### Database

```bash
# Run migrations manually
psql -h localhost -U postgres -d monorepo -f migrations/001_initial.sql

# Migrations are applied via init.sql on first Docker startup
```

### Alert Management (API)

```bash
# Initialize default alert rules
pnpm -F @monorepo/api alert:init

# List all alert rules
pnpm -F @monorepo/api alert:list

# View alert statistics
pnpm -F @monorepo/api alert:stats

# Start alert monitoring (also via ENABLE_ALERT_MONITORING=true)
pnpm -F @monorepo/api alert:monitor
```

## Architecture

### API Layer (apps/api)

- **Framework**: Fastify with @fastify/cors and @fastify/multipart
- **Routes**: Each domain has its own route file (import, task, feedback, review, export, analytics, auth)
- **Services**: Business logic separated into service files (import.service.ts, task.service.ts, etc.)
- **Middleware**: Authentication via JWT tokens (auth.middleware.ts)
- **Database**: PostgreSQL via pg Pool (direct SQL queries, no ORM)
- **Validation**: All input validated with Zod schemas from @monorepo/shared

Key endpoints:
- `/import/jobs` - CSV import with validation
- `/tasks/*` - Task assignment and management
- `/tasks/:id/draft` - Save annotation drafts (auto-save)
- `/tasks/:id/submit` - Submit final annotations
- `/export/*` - Export snapshots to CSV/JSON
- `/analytics/*` - Analytics and metrics
- `/alerts/*` - Alert rule configuration

### Worker Layer (apps/worker)

- **Queue**: BullMQ with Redis for job processing
- **Link Health Queue**: Monitors external link health with metrics
- **Metrics**: Prometheus metrics exposed on port 9090 (/metrics, /health)
- **Concurrency**: Configurable worker pool (default: 5 concurrent jobs)

### Web Layer (apps/web)

- **Framework**: React 18 + Vite + TypeScript
- **UI Library**: Mantine v8 (components, forms, notifications, modals)
- **Routing**: React Router v7
- **State**: TanStack Query (React Query) for server state
- **Auth**: JWT-based authentication with AuthContext
- **Routes**: Role-based access control (ProtectedRoute, AnnotatorRoute)

Key pages:
- `/tasks` - Task list with filtering and pagination
- `/tasks/:id` - Task detail with annotation drawer
- `/import` - CSV import with validation preview
- `/export` - Export builder with snapshot management
- `/analytics` - Analytics dashboard with charts
- `/reviews` - Review submitted annotations
- `/feedback` - Feedback management
- `/alerts` - Alert configuration (admin only)

### Shared Package (packages/shared)

Central source of truth for:
- **Zod Schemas**: Type-safe validation schemas exported from schemas.ts
- **CSV Validation**: Comprehensive CSV parsing and validation (csv-validation.ts)
- **Ontology Enums**: ScanType, Feedback, Result, Reaction (ontology.ts)
- **Type Exports**: All TypeScript types derived from Zod schemas

When modifying data structures, always update schemas in shared package first.

### Database Schema

Key tables:
- `tasks` - Main task data (status: pending | in_progress | completed | skipped)
- `labels_draft` - Auto-saved annotation drafts (one per task)
- `labels_final` - Submitted annotations (immutable after submit)
- `task_events` - Audit log of all task actions (start, annotate_draft, submit, skip, assign)
- `import_jobs` - CSV import job tracking
- `snapshots` - Point-in-time exports for analytics
- `exports` - Export job metadata
- `alert_rules` - Alert configuration
- `alert_notifications` - Alert notification history

Migration files are numbered sequentially (001, 002, etc.). Always create new migrations with the next number.

### CSV Import & Validation

CSV validation is critical. Required fields:
- `date` (ISO-8601), `request_id` (unique), `user_id`, `team_id`
- `type` (enum: content_moderation, safety_check, etc.)
- `user_input` (HTTP/HTTPS image URL)
- `raw_ai_output` (valid JSON string)

Validation occurs in two phases:
1. Header validation (missing/extra columns)
2. Row-by-row validation with detailed error reporting (field, line, code, message)

See packages/shared/CSV_VALIDATION.md for complete documentation.

### Annotation Workflow

1. **Assign/Start**: Task status → `in_progress`, assigned_to set, task_event created
2. **Draft Auto-save**: Frontend periodically saves to `labels_draft` table
3. **Submit**: Draft moved to `labels_final`, task status → `completed`, event logged
4. **Skip**: Task status → `skipped`, task remains unassigned

Critical: Draft and final are separate tables. Submissions are immutable once in labels_final.

### Authentication & Authorization

- JWT tokens stored in httpOnly cookies (apps/api/src/services/auth.service.ts)
- Frontend uses AuthContext to manage user state
- Protected routes check authentication
- Role-based access: `user`, `annotator`, `reviewer`, `admin`
- Admin-only routes: `/alerts`

## Key Patterns

### Adding a New API Endpoint

1. Define Zod schema in `packages/shared/src/schemas.ts`
2. Create/update route file in `apps/api/src/routes/`
3. Create/update service file in `apps/api/src/services/`
4. Register route in `apps/api/src/index.ts`
5. Update frontend service in `apps/web/src/services/`

### Adding a New Migration

1. Create file: `migrations/0XX_description.sql` (increment number)
2. Add SQL DDL statements
3. Update init.sql if needed for fresh installs
4. Run migration against database
5. Update TypeScript types in shared package if schema changed

### Working with the Annotation Drawer

The AnnotationDrawer component (`apps/web/src/components/AnnotationDrawer.tsx`) is the main UI for annotations:
- Auto-saves drafts every 30 seconds
- Validates before submission
- Handles keyboard shortcuts (Ctrl+S to save)
- Shows draft status and last saved timestamp

When modifying annotation fields, update:
1. Database schema (labels_draft/labels_final tables)
2. Zod schemas in shared package
3. Frontend form components
4. API endpoints (draft/submit routes)

### Export & Snapshots

Exports use a snapshot-based system:
1. Create snapshot from current task state (captures point-in-time data)
2. Generate export from snapshot (CSV or JSON format)
3. Snapshots are immutable; exports can be regenerated

This allows historical analysis and reproducible exports.

## Environment Variables

### API (apps/api)
```
PORT=4000
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=monorepo
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
ENABLE_ALERT_MONITORING=true
ALERT_EVALUATION_INTERVAL=60
ALERT_WEBHOOK_URL=<webhook-url>
JWT_SECRET=<secret>
```

### Worker (apps/worker)
```
REDIS_HOST=localhost
REDIS_PORT=6379
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=monorepo
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
METRICS_PORT=9090
```

### Web (apps/web)
```
VITE_API_URL=http://localhost:4000
```

## Common Issues

### Import Validation Errors

When CSV imports fail validation:
1. Check error CSV downloaded from API (contains field-level errors)
2. Verify enum values match ontology.ts
3. Ensure URLs are HTTP/HTTPS and contain image indicators
4. Validate JSON strings are properly escaped

### Task Assignment Race Conditions

The system uses PostgreSQL row locking (FOR UPDATE SKIP LOCKED) to prevent double-assignment.
If encountering assignment issues, check apps/api/src/services/task.service.ts:startTask().

### Draft Not Saving

Auto-save requires:
1. Task must be in `in_progress` status
2. Task must be assigned to current user
3. Frontend must send valid draft payload to /tasks/:id/draft
4. Draft endpoint validates against Zod schema before saving

### Worker Jobs Not Processing

Check:
1. Redis is running (docker-compose up -d)
2. Worker is running (pnpm -F @monorepo/worker dev)
3. Jobs are being added to queue (check Redis keys)
4. Worker logs for errors

## Package Manager

This project uses pnpm with workspaces. Key commands:
- Use `-F` flag to filter by package: `pnpm -F @monorepo/api <cmd>`
- Use `-r` for recursive across all packages: `pnpm -r build`
- Use `--parallel` for concurrent execution: `pnpm -r --parallel dev`
- Workspace dependencies: `"@monorepo/shared": "workspace:*"`

Node version: >=18.0.0, pnpm version: >=8.0.0 (see root package.json engines).
