# Monorepo Project

A full-stack TypeScript monorepo using pnpm workspaces with Vite React, Fastify API, BullMQ Worker, and shared Zod schemas.

## Project Structure

```
monorepo-project/
├── apps/
│   ├── web/          # Vite + React + TypeScript + Mantine
│   ├── api/          # Fastify API server
│   └── worker/       # BullMQ worker
├── packages/
│   └── shared/       # Shared Zod schemas and types
├── docker-compose.yml
└── init.sql
```

## Prerequisites

- Node.js >= 18
- pnpm >= 8
- Docker and Docker Compose

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start Docker services

```bash
docker-compose up -d
```

This will start:
- PostgreSQL 15 on port 5432
- Redis 7 on port 6379

### 3. Build all packages

```bash
pnpm -w build
```

### 4. Start development servers

```bash
pnpm dev
```

This will start:
- Web app on http://localhost:3000
- API server on http://localhost:4000
- Worker process

## Available Scripts

- `pnpm dev` - Start all apps in development mode
- `pnpm build` - Build all packages and apps
- `pnpm lint` - Lint all packages
- `pnpm format` - Format code with Prettier
- `pnpm type-check` - Type check all packages

## Services

### Web App (apps/web)

- Built with Vite, React, TypeScript, and Mantine UI
- Available at http://localhost:3000
- Uses shared schemas from `@monorepo/shared`

### API Server (apps/api)

- Built with Fastify and TypeScript
- Available at http://localhost:4000
- Endpoints:
  - `GET /health` - Health check with database status
  - `GET /users` - List users
  - `POST /users` - Create user

### Worker (apps/worker)

- Built with BullMQ and TypeScript
- Processes background jobs from Redis queue
- Supports job types: email, notification, data-processing

### Shared Package (packages/shared)

- Contains Zod schemas and TypeScript types
- Used by all apps for type safety and validation

## Docker Services

### PostgreSQL

- Image: postgres:15-alpine
- Port: 5432
- Database: monorepo
- User/Password: postgres/postgres

### Redis

- Image: redis:7-alpine
- Port: 6379

## Health Checks

Both Docker services include health checks:

```bash
# Check Docker service health
docker-compose ps

# Check API health
curl http://localhost:4000/health
```

## Development

Each app can be developed independently:

```bash
# Web only
cd apps/web && pnpm dev

# API only
cd apps/api && pnpm dev

# Worker only
cd apps/worker && pnpm dev
```

## License

MIT
