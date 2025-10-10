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

  // Feedback
  {
    method: 'POST',
    path: '/feedback/events',
    description: 'Record end-user feedback event',
    category: 'Feedback',
  },
  {
    method: 'GET',
    path: '/feedback/events/:requestId',
    description: 'Get feedback events for a specific request',
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
    path: '/export/snapshots',
    description: 'Create a new export snapshot',
    category: 'Export',
  },
  {
    method: 'GET',
    path: '/export/snapshots',
    description: 'List all export snapshots',
    category: 'Export',
  },
  {
    method: 'GET',
    path: '/export/snapshots/:snapshotId',
    description: 'Get snapshot details',
    category: 'Export',
  },
  {
    method: 'POST',
    path: '/export/snapshots/:snapshotId/download',
    description: 'Download snapshot as CSV',
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
      </Stack>
    </Container>
  );
}
