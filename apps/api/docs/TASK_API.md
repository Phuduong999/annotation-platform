# Task API Documentation

This document describes the Task API endpoints for creating tasks from import jobs and assigning them to users.

## Table of Contents

- [Overview](#overview)
- [Endpoints](#endpoints)
  - [Create Tasks from Import Job](#create-tasks-from-import-job)
  - [Assign Tasks (Equal Split)](#assign-tasks-equal-split)
  - [Get Next Task (Pull Queue)](#get-next-task-pull-queue)
  - [Get Task Statistics](#get-task-statistics)
  - [Get User Tasks](#get-user-tasks)
  - [Get Assignment Logs](#get-assignment-logs)
- [Data Models](#data-models)
- [Assignment Strategies](#assignment-strategies)
- [Error Handling](#error-handling)

## Overview

The Task API provides endpoints for:

1. **Task Creation**: Generate task stubs from validated import rows with healthy links
2. **Equal-Split Assignment**: Distribute unassigned tasks evenly among specified users
3. **Pull-Based Queue**: Allow users to pull the next highest-priority task
4. **Task Monitoring**: View task statistics, user tasks, and assignment history

## Endpoints

### Create Tasks from Import Job

Creates tasks from all valid import rows with `link_status='ok'` in a specific import job.

**Endpoint**: `POST /tasks/create`

**Request Body**:
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "tasksCreated": 150,
    "jobId": "550e8400-e29b-41d4-a716-446655440000"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Notes**:
- Only creates tasks for rows with `status='valid'` and `link_status='ok'`
- Skips rows that already have associated tasks
- Uses `ai_confidence` from the import row as the task priority

### Assign Tasks (Equal Split)

Assigns unassigned tasks equally among specified users.

**Endpoint**: `POST /tasks/assign`

**Request Body**:
```json
{
  "userIds": ["user1", "user2", "user3"],
  "quotaPerUser": 50
}
```

**Parameters**:
- `userIds` (required): Array of user IDs to assign tasks to
- `quotaPerUser` (optional): Maximum tasks per user (defaults to equal split of available tasks)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalAssigned": 150,
    "assignments": {
      "user1": 50,
      "user2": 50,
      "user3": 50
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Notes**:
- Only assigns tasks with `status='pending'` and `assigned_to IS NULL`
- Records assignment in `task_assignments` table with `method='equal_split'`
- Updates task `assigned_to`, `assigned_at`, and `assignment_method` fields

### Get Next Task (Pull Queue)

Fetches the next highest-priority unassigned task for a user (pull-based assignment).

**Endpoint**: `GET /tasks/next?user_id=user123`

**Query Parameters**:
- `user_id` (required): User ID requesting the task

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "task-uuid",
    "scan_date": "2024-01-15T09:00:00.000Z",
    "request_id": "req-001",
    "user_id": "original-user",
    "team_id": "team-alpha",
    "type": "explicit",
    "user_input": "https://example.com/image.jpg",
    "raw_ai_output": "{\"classification\":\"explicit\",\"confidence\":0.95}",
    "ai_confidence": 0.95,
    "status": "pending",
    "assigned_to": "user123",
    "assigned_at": "2024-01-15T10:30:00.000Z",
    "assignment_method": "pull_queue",
    "created_at": "2024-01-15T10:00:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Not Found Response** (404 Not Found):
```json
{
  "success": false,
  "error": "No tasks available",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Notes**:
- Selects from tasks with `status='pending'` and `assigned_to IS NULL`
- Orders by `ai_confidence DESC` (highest confidence first)
- Automatically assigns the task to the requesting user
- Records assignment in `task_assignments` table with `method='pull_queue'`
- Uses row-level locking (`FOR UPDATE SKIP LOCKED`) to prevent race conditions

### Get Task Statistics

Retrieves overall task statistics.

**Endpoint**: `GET /tasks/stats`

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "total": 500,
    "pending": 150,
    "in_progress": 200,
    "completed": 100,
    "failed": 50,
    "unassigned": 75
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Get User Tasks

Retrieves all tasks assigned to a specific user.

**Endpoint**: `GET /tasks/user/:userId`

**Path Parameters**:
- `userId` (required): User ID

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "task-uuid-1",
      "scan_date": "2024-01-15T09:00:00.000Z",
      "request_id": "req-001",
      "user_id": "original-user",
      "team_id": "team-alpha",
      "type": "explicit",
      "user_input": "https://example.com/image1.jpg",
      "raw_ai_output": "{\"classification\":\"explicit\",\"confidence\":0.95}",
      "ai_confidence": 0.95,
      "status": "pending",
      "assigned_to": "user123",
      "assigned_at": "2024-01-15T10:00:00.000Z",
      "assignment_method": "equal_split",
      "created_at": "2024-01-15T09:30:00.000Z",
      "updated_at": "2024-01-15T10:00:00.000Z"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Get Assignment Logs

Retrieves task assignment history with optional filters.

**Endpoint**: `GET /tasks/assignments?user_id=user123&method=pull_queue&limit=50`

**Query Parameters**:
- `user_id` (optional): Filter by assigned user
- `method` (optional): Filter by assignment method (`equal_split` or `pull_queue`)
- `limit` (optional): Maximum number of logs to return (default: 100)

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "assignment-uuid",
      "task_id": "task-uuid",
      "assigned_to": "user123",
      "assigned_by": null,
      "method": "pull_queue",
      "assigned_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Data Models

### Task

```typescript
interface Task {
  id: string;                    // UUID
  import_row_id: string;         // Reference to import_rows
  scan_date: string;             // ISO-8601 timestamp
  request_id: string;
  user_id: string;
  team_id: string;
  type: 'explicit' | 'adult' | 'suggestive' | 'medical';
  user_input: string;            // Image URL
  raw_ai_output: string;         // JSON string
  ai_confidence: number;         // 0.0 to 1.0
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assigned_to: string | null;
  assigned_at: string | null;
  assignment_method: 'equal_split' | 'pull_queue' | null;
  completed_at: string | null;
  result: object | null;         // JSON
  created_at: string;
  updated_at: string;
}
```

### TaskAssignment

```typescript
interface TaskAssignment {
  id: string;                    // UUID
  task_id: string;               // Reference to tasks
  assigned_to: string;
  assigned_by: string | null;    // Admin/system that triggered assignment
  method: 'equal_split' | 'pull_queue';
  assigned_at: string;           // ISO-8601 timestamp
}
```

## Assignment Strategies

### Equal Split

**Use Case**: Batch assignment when you have a known set of users and want to distribute work evenly.

**Behavior**:
- Fetches all unassigned tasks
- Distributes them round-robin among specified users
- Respects optional `quotaPerUser` limit
- Updates tasks in a single transaction

**Example**:
```bash
curl -X POST http://localhost:4000/tasks/assign \
  -H "Content-Type: application/json" \
  -d '{
    "userIds": ["alice", "bob", "charlie"],
    "quotaPerUser": 50
  }'
```

### Pull Queue

**Use Case**: On-demand assignment where users request tasks as they become available.

**Behavior**:
- User requests next task via API
- System finds highest-priority unassigned task
- Task is immediately assigned to requesting user
- Uses pessimistic locking to prevent concurrent assignment

**Example**:
```bash
curl http://localhost:4000/tasks/next?user_id=alice
```

**Priority**: Tasks are ordered by `ai_confidence DESC`, so high-confidence classifications are processed first.

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Common HTTP Status Codes**:
- `200 OK`: Successful request
- `404 Not Found`: Resource not found (e.g., no tasks available)
- `500 Internal Server Error`: Server-side error

## Example Workflow

### 1. Import CSV and Create Tasks

```bash
# Upload CSV file
curl -X POST http://localhost:4000/import/jobs \
  -F "file=@data.csv"

# Create tasks from import job
curl -X POST http://localhost:4000/tasks/create \
  -H "Content-Type: application/json" \
  -d '{"jobId": "550e8400-e29b-41d4-a716-446655440000"}'
```

### 2. Assign Tasks (Equal Split)

```bash
curl -X POST http://localhost:4000/tasks/assign \
  -H "Content-Type: application/json" \
  -d '{
    "userIds": ["alice", "bob", "charlie"],
    "quotaPerUser": 100
  }'
```

### 3. User Pulls Next Task

```bash
curl http://localhost:4000/tasks/next?user_id=alice
```

### 4. Monitor Task Progress

```bash
# Get overall statistics
curl http://localhost:4000/tasks/stats

# Get user-specific tasks
curl http://localhost:4000/tasks/user/alice

# Get assignment logs
curl http://localhost:4000/tasks/assignments?user_id=alice&limit=50
```

## Notes

- Tasks are only created for import rows with valid data and healthy links (`link_status='ok'`)
- The `ai_confidence` field from import rows determines task priority in the pull queue
- Both assignment methods record audit logs in the `task_assignments` table
- Task status transitions: `pending` → `in_progress` → `completed`/`failed`
- Use equal-split for batch processing, pull-queue for dynamic workload distribution
