import { Container, Title, Text, Stack, Table, Badge, Code, Paper } from '@mantine/core';

interface ApiRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  category: string;
}

const apiRoutes: ApiRoute[] = [
  // Health & System
  {
    method: 'GET',
    path: '/health',
    description: 'Health check endpoint with database status',
    category: 'System',
  },
  {
    method: 'GET',
    path: '/users',
    description: 'List all users (sample endpoint)',
    category: 'System',
  },
  {
    method: 'POST',
    path: '/users',
    description: 'Create a new user',
    category: 'System',
  },

  // Import
  {
    method: 'POST',
    path: '/import/jobs',
    description: 'Upload and process CSV file for importing tasks',
    category: 'Import',
  },
  {
    method: 'GET',
    path: '/import/jobs/:jobId',
    description: 'Get import job details and status',
    category: 'Import',
  },
  {
    method: 'GET',
    path: '/import/jobs/:jobId/errors',
    description: 'Download error report CSV for failed rows',
    category: 'Import',
  },

  // Tasks
  {
    method: 'GET',
    path: '/tasks',
    description: 'List all tasks with filtering and pagination',
    category: 'Tasks',
  },
  {
    method: 'GET',
    path: '/tasks/:id',
    description: 'Get single task with feedback details',
    category: 'Tasks',
  },
  {
    method: 'POST',
    path: '/tasks/create',
    description: 'Create tasks from import job',
    category: 'Tasks',
  },
  {
    method: 'POST',
    path: '/tasks/assign',
    description: 'Assign tasks using equal-split method',
    category: 'Tasks',
  },
  {
    method: 'GET',
    path: '/tasks/next',
    description: 'Get next available task for user (pull-based queue)',
    category: 'Tasks',
  },
  {
    method: 'GET',
    path: '/tasks/stats',
    description: 'Get task statistics and assignment info',
    category: 'Tasks',
  },
  {
    method: 'GET',
    path: '/tasks/user/:userId',
    description: "Get all tasks assigned to a specific user",
    category: 'Tasks',
  },
  {
    method: 'GET',
    path: '/tasks/assignments',
    description: 'Get assignment logs with filtering',
    category: 'Tasks',
  },

  // Task Annotation Endpoints (NEW)
  {
    method: 'PUT',
    path: '/tasks/:id/start',
    description: 'Start working on a task (auto-assigns if pending)',
    category: 'Tasks',
  },
  {
    method: 'PUT',
    path: '/tasks/:id/annotate',
    description: 'Save draft annotation with 3-enum validation',
    category: 'Tasks',
  },
  {
    method: 'PUT',
    path: '/tasks/:id/submit',
    description: 'Submit final annotation (completes task)',
    category: 'Tasks',
  },
  {
    method: 'PUT',
    path: '/tasks/:id/skip',
    description: 'Skip task with reason (returns to queue)',
    category: 'Tasks',
  },

  // Feedback Events
  {
    method: 'POST',
    path: '/events/feedback',
    description: 'Record end-user feedback event (with idempotency support)',
    category: 'Feedback',
  },
  {
    method: 'GET',
    path: '/events/feedback',
    description: 'List feedback events with pagination and filters',
    category: 'Feedback',
  },
  {
    method: 'GET',
    path: '/events/feedback/:requestId',
    description: 'Get feedback events for a specific request',
    category: 'Feedback',
  },
  {
    method: 'GET',
    path: '/feedback/categories',
    description: 'Get unique feedback categories with counts',
    category: 'Feedback',
  },
  {
    method: 'GET',
    path: '/feedback/stats',
    description: 'Get feedback statistics by category and reaction',
    category: 'Feedback',
  },

  // Review
  {
    method: 'POST',
    path: '/reviews',
    description: 'Create a new review for a task',
    category: 'Review',
  },
  {
    method: 'GET',
    path: '/reviews/task/:taskId',
    description: 'Get all reviews for a specific task',
    category: 'Review',
  },
  {
    method: 'GET',
    path: '/reviews/reviewer/:reviewerId',
    description: 'Get all reviews by a specific reviewer',
    category: 'Review',
  },
  {
    method: 'PUT',
    path: '/reviews/:reviewId/resolve',
    description: 'Resolve a review with resolution notes',
    category: 'Review',
  },

  // Issues
  {
    method: 'POST',
    path: '/issues',
    description: 'Report an issue with a task',
    category: 'Review',
  },
  {
    method: 'GET',
    path: '/issues/task/:taskId',
    description: 'Get all issues for a specific task',
    category: 'Review',
  },
  {
    method: 'PUT',
    path: '/issues/:issueId/resolve',
    description: 'Resolve an issue',
    category: 'Review',
  },

  // Export & Snapshots
  {
    method: 'POST',
    path: '/snapshots',
    description: 'Create a new export snapshot with stratified splitting',
    category: 'Export',
  },
  {
    method: 'GET',
    path: '/snapshots',
    description: 'List all export snapshots with filtering',
    category: 'Export',
  },
  {
    method: 'POST',
    path: '/snapshots/:id/publish',
    description: 'Publish a snapshot for external access',
    category: 'Export',
  },
  {
    method: 'GET',
    path: '/exports',
    description: 'Export snapshot data in CSV/JSON/JSONL format',
    category: 'Export',
  },
  {
    method: 'GET',
    path: '/exports/manifest/:snapshotId',
    description: 'Get export manifest with ontology and metadata',
    category: 'Export',
  },

  // Analytics
  {
    method: 'GET',
    path: '/analytics/metrics',
    description: 'Get time-series metrics data',
    category: 'Analytics',
  },
  {
    method: 'GET',
    path: '/analytics/kpis',
    description: 'Get key performance indicators',
    category: 'Analytics',
  },

  // Alerts
  {
    method: 'GET',
    path: '/alerts',
    description: 'List all alert rules',
    category: 'Alerts',
  },
  {
    method: 'POST',
    path: '/alerts',
    description: 'Create a new alert rule',
    category: 'Alerts',
  },
  {
    method: 'PUT',
    path: '/alerts/:alertId',
    description: 'Update an alert rule',
    category: 'Alerts',
  },
  {
    method: 'DELETE',
    path: '/alerts/:alertId',
    description: 'Delete an alert rule',
    category: 'Alerts',
  },
  {
    method: 'GET',
    path: '/alerts/history',
    description: 'Get alert trigger history',
    category: 'Alerts',
  },
  {
    method: 'POST',
    path: '/alerts/:alertId/acknowledge',
    description: 'Acknowledge an alert',
    category: 'Alerts',
  },
];

const getMethodColor = (method: string) => {
  switch (method) {
    case 'GET':
      return 'blue';
    case 'POST':
      return 'green';
    case 'PUT':
      return 'yellow';
    case 'DELETE':
      return 'red';
    default:
      return 'gray';
  }
};

const groupedRoutes = apiRoutes.reduce((acc, route) => {
  if (!acc[route.category]) {
    acc[route.category] = [];
  }
  acc[route.category].push(route);
  return acc;
}, {} as Record<string, ApiRoute[]>);

export function ApiDocs() {
  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <div>
          <Title order={1}>API Documentation</Title>
          <Text size="sm" c="dimmed" mt="xs">
            Complete list of available API endpoints in D4T4L4B3lXAI platform
          </Text>
        </div>

        <Paper withBorder p="md">
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Base URL
            </Text>
            <Code block>http://localhost:4000</Code>
          </Stack>
        </Paper>

        {Object.entries(groupedRoutes).map(([category, routes]) => (
          <Stack key={category} gap="sm">
            <Title order={3}>{category}</Title>
            <Paper withBorder>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: '100px' }}>Method</Table.Th>
                    <Table.Th>Endpoint</Table.Th>
                    <Table.Th>Description</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {routes.map((route, index) => (
                    <Table.Tr key={`${route.method}-${route.path}-${index}`}>
                      <Table.Td>
                        <Badge color={getMethodColor(route.method)} size="sm">
                          {route.method}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Code>{route.path}</Code>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{route.description}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          </Stack>
        ))}

        <Paper withBorder p="md">
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Response Format
            </Text>
            <Text size="xs" c="dimmed">
              All API responses follow a consistent format:
            </Text>
            <Code block>{`{
  "success": true|false,
  "data": { ... },
  "error": "Error message if failed",
  "timestamp": "2025-10-09T18:00:00.000Z"
}`}</Code>
          </Stack>
        </Paper>

        <Paper withBorder p="md">
          <Stack gap="md">
            <Text size="sm" fw={500}>
              Feedback API Examples
            </Text>
            
            <div>
              <Text size="xs" fw={500}>POST /events/feedback - Submit Feedback</Text>
              <Text size="xs" c="dimmed" mb="xs">
                Submit feedback with idempotency support. Use Idempotency-Key header to prevent duplicates.
              </Text>
              <Code block>{`# Headers
Content-Type: application/json
Idempotency-Key: feedback-req123-20241010-001  # Optional

# Request Body
{
  "request_id": "req_123456789",
  "user_event_id": "user_evt_001",  # Optional
  "reaction": "like",
  "category": "accuracy",
  "note": "Great food detection!",
  "source": "mobile_app"
}

# Success Response (201)
{
  "success": true,
  "data": {
    "id": "fb_uuid_123",
    "request_id": "req_123456789",
    "user_event_id": "user_evt_001",
    "reaction": "like",
    "category": "accuracy",
    "note": "Great food detection!",
    "source": "mobile_app",
    "created_at": "2024-10-10T10:30:00Z",
    "idempotency_key": "feedback-req123-20241010-001"
  },
  "timestamp": "2024-10-10T10:30:00Z"
}

# Duplicate Feedback (409)
{
  "success": false,
  "error": "Feedback already exists for this request",
  "error_code": "DUPLICATE_FEEDBACK",
  "details": "A feedback event already exists for this request_id and user_event_id combination",
  "timestamp": "2024-10-10T10:30:01Z"
}`}</Code>
            </div>
            
            <div>
              <Text size="xs" fw={500}>GET /events/feedback - List with Pagination & Filters</Text>
              <Text size="xs" c="dimmed" mb="xs">
                List feedback events with comprehensive filtering and pagination.
              </Text>
              <Code block>{`# Query Parameters
GET /events/feedback?reaction=like&category=accuracy&limit=50&offset=0

# Response
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "fb_uuid_123",
        "request_id": "req_123456789",
        "user_event_id": "user_evt_001",
        "reaction": "like",
        "category": "accuracy",
        "note": "Great food detection!",
        "source": "mobile_app",
        "created_at": "2024-10-10T10:30:00Z",
        "idempotency_key": "feedback-req123-20241010-001"
      }
    ],
    "total": 1,
    "limit": 50,
    "offset": 0,
    "has_more": false
  },
  "timestamp": "2024-10-10T10:30:00Z"
}

# Available Filters:
# - request_id: Filter by specific request
# - reaction: like|dislike|neutral
# - category: Filter by category (partial match)
# - source: Filter by source system
# - from_date: ISO date string (>=)
# - to_date: ISO date string (<=)
# - limit: 1-1000, default 100
# - offset: 0+, default 0`}</Code>
            </div>
          </Stack>
        </Paper>
        
        <Paper withBorder p="md">
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Enum Values
            </Text>
            <Text size="xs" c="dimmed">
              System uses the following standardized enum values:
            </Text>
            <Stack gap="sm">
              <div>
                <Text size="xs" fw={500}>Scan Types:</Text>
                <Code>meal | label | front_label | screenshot | others</Code>
              </div>
              <div>
                <Text size="xs" fw={500}>Feedback Reactions:</Text>
                <Code>like | dislike | neutral</Code>
              </div>
              <div>
                <Text size="xs" fw={500}>Result Return:</Text>
                <Code>correct_result | wrong_result | no_result</Code>
              </div>
              <div>
                <Text size="xs" fw={500}>Feedback Correction:</Text>
                <Code>wrong_food | incorrect_nutrition | incorrect_ingredients | wrong_portion_size</Code>
              </div>
              <div>
                <Text size="xs" fw={500}>Task Status:</Text>
                <Code>pending | assigned | in_progress | completed | skipped</Code>
              </div>
            </Stack>
          </Stack>
        </Paper>
        
        <Paper withBorder p="md">
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Error Codes
            </Text>
            <Text size="xs" c="dimmed">
              Common error codes and their meanings:
            </Text>
            <Stack gap="sm">
              <div>
                <Text size="xs" fw={500}>409 DUPLICATE_FEEDBACK:</Text>
                <Text size="xs" c="dimmed">Feedback already exists for request_id + user_event_id combination</Text>
              </div>
              <div>
                <Text size="xs" fw={500}>409 DUPLICATE_IDEMPOTENCY_KEY:</Text>
                <Text size="xs" c="dimmed">The idempotency key has already been used</Text>
              </div>
              <div>
                <Text size="xs" fw={500}>400 VALIDATION_ERROR:</Text>
                <Text size="xs" c="dimmed">Request body validation failed</Text>
              </div>
              <div>
                <Text size="xs" fw={500}>404 NOT_FOUND:</Text>
                <Text size="xs" c="dimmed">Requested resource not found</Text>
              </div>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
