# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repository Overview

This is a TypeScript monorepo using pnpm workspaces with three main applications and a shared package:
- **apps/web**: React frontend with Vite and Mantine UI
- **apps/api**: Fastify API server with PostgreSQL
- **apps/worker**: Background job processor with BullMQ and Redis
- **packages/shared**: Shared TypeScript schemas and utilities using Zod

## Essential Commands

### Initial Setup
```bash
# Install dependencies for all packages
pnpm install

# Start required Docker services (PostgreSQL and Redis)
docker-compose up -d

# Run database migrations
psql -U postgres -h localhost -d monorepo < init.sql
psql -U postgres -h localhost -d monorepo < migrations/*.sql
```

### Development
```bash
# Start all services in parallel (from root)
pnpm dev

# Individual services
pnpm -F @monorepo/web dev      # Web app on http://localhost:3000
pnpm -F @monorepo/api dev      # API on http://localhost:4000
pnpm -F @monorepo/worker dev   # Background worker

# Build all packages
pnpm build

# Build specific package
pnpm -F @monorepo/web build
```

### Testing & Linting
```bash
# Run linting across all packages
pnpm lint

# Type checking
pnpm type-check

# Run tests (only in shared package currently)
pnpm -F @monorepo/shared test
pnpm -F @monorepo/shared test:watch

# Test services health
./test-services.sh

# Format code
pnpm format
```

### Alert Management (API-specific)
```bash
# Initialize default alert rules
pnpm -F @monorepo/api alert:init

# List configured alert rules
pnpm -F @monorepo/api alert:list

# Show alert statistics
pnpm -F @monorepo/api alert:stats

# Start alert monitoring
pnpm -F @monorepo/api alert:monitor
```

## Architecture & Key Patterns

### Monorepo Structure
The project uses pnpm workspaces with TypeScript project references for fast builds and proper type checking across packages. Each app extends `tsconfig.base.json` and references the shared package via TypeScript paths.

### Shared Package Pattern
All shared types, schemas, and utilities live in `packages/shared`. Apps import from `@monorepo/shared` which is resolved through TypeScript paths and pnpm workspace protocol. The shared package exports:
- Zod schemas for runtime validation
- TypeScript types derived from schemas
- CSV validation and parsing utilities
- Ontology definitions

### API Architecture
The Fastify API uses a modular route organization:
- Routes are organized by domain (import, task, feedback, review, export, analytics)
- Each route module exports an async function that registers endpoints
- Database connection is passed through dependency injection
- All responses follow the `ApiResponse<T>` schema from shared package

### Worker Queue System
The worker uses BullMQ with Redis for job processing:
- Separate queues for different job types (configured in `queues/`)
- Prometheus metrics integration for monitoring
- PostgreSQL integration for persisting job results
- Image processing with Sharp library

### Database Connections
Both API and worker connect directly to PostgreSQL using the `pg` library. Connection pooling is handled by creating a single Pool instance that's shared across the application. Environment variables control connection parameters with sensible defaults.

### Frontend State Management
The web app uses:
- React Query (TanStack Query) for server state management
- Mantine components with built-in form handling
- React Router for navigation
- Axios for API communication

### Import Flow with Link Health
The system includes sophisticated CSV import functionality with link health checking:
1. CSV uploads are validated against schemas in shared package
2. Links are health-checked by the worker (checking status codes, MIME types, timeouts)
3. Failed links are tracked with specific error statuses (404, timeout, invalid_mime, decode_error)
4. Error CSVs can be downloaded with detailed error messages
5. Tasks are only created for assets with valid links

## Environment Configuration

Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

Key environment variables:
- `POSTGRES_*`: Database connection settings
- `REDIS_*`: Redis connection for job queues
- `API_PORT`: API server port (default: 4000)
- `WEB_PORT`: Web app port (default: 3000)
- `ENABLE_ALERT_MONITORING`: Enable alert monitoring in API
- `ALERT_EVALUATION_INTERVAL`: Alert check interval in seconds

## Development Services

Services exposed when running `docker-compose up`:
- PostgreSQL: `localhost:5432` (user: postgres, password: postgres, db: monorepo)
- Redis: `localhost:6379`

## Code Style & Conventions

- ESLint configuration extends from root `.eslintrc.js`
- Prettier formatting with 2-space indentation
- TypeScript strict mode enabled
- Unused variables prefixed with underscore are allowed
- All async operations use ES modules (.js extensions in imports)
- Composite TypeScript projects for incremental builds