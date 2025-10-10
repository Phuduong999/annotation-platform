import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDisclosure } from '@mantine/hooks';
import {
  Container,
  Title,
  Group,
  Select,
  Switch,
  Card,
  Badge,
  Button,
  Text,
  Stack,
  Loader,
  Center,
  Drawer,
  ScrollArea,
  Divider,
  Code,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { notifications } from '@mantine/notifications';
import { IconRefresh, IconEye, IconPlayerPlay, IconUpload } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { taskService } from '../services/task.service';
import { Task, TaskFilter } from '../types/task.types';

const PAGE_SIZE = 20;

export function TaskList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<TaskFilter>({});
  const [selectedRecords, setSelectedRecords] = useState<Task[]>([]);
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Mock current user - in real app this would come from auth context
  const currentUser = 'user123';

  // Fetch tasks
  const { data: tasks = [], isLoading, refetch, isFetched } = useQuery({
    queryKey: ['tasks', filter],
    queryFn: () => taskService.getTasks({
      ...filter,
      assigned_to_me: filter.assigned_to_me ? true : undefined,
    }),
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['taskStats'],
    queryFn: () => taskService.getTaskStats(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Get next task
  const handleGetNextTask = async () => {
    try {
      const task = await taskService.getNextTask(currentUser);
      if (task) {
        navigate(`/tasks/${task.id}`);
      } else {
        notifications.show({
          title: 'No tasks available',
          message: 'All tasks are currently assigned or completed',
          color: 'yellow',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to get next task',
        color: 'red',
      });
    }
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'pending':
        return 'blue';
      case 'in_progress':
        return 'yellow';
      case 'completed':
        return 'green';
      case 'failed':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getTypeColor = (type: Task['type']) => {
    switch (type) {
      case 'meal':
        return 'green';
      case 'label':
        return 'blue';
      case 'front_label':
        return 'cyan';
      case 'screenshot':
        return 'purple';
      case 'others':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const columns = [
    {
      accessor: 'id',
      title: 'ID',
      width: 100,
      render: (task: Task) => (
        <Text size="xs" c="dimmed">
          {task.id.slice(0, 8)}...
        </Text>
      ),
    },
    {
      accessor: 'request_id',
      title: 'Request ID',
      width: 120,
    },
    {
      accessor: 'type',
      title: 'Type',
      width: 100,
      render: (task: Task) => (
        <Badge color={getTypeColor(task.type)} size="sm">
          {task.type}
        </Badge>
      ),
    },
    {
      accessor: 'status',
      title: 'Status',
      width: 100,
      render: (task: Task) => (
        <Badge color={getStatusColor(task.status)} size="sm">
          {task.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      accessor: 'ai_confidence',
      title: 'AI Confidence',
      width: 120,
      render: (task: Task) => (
        <Text size="sm">
          {(task.ai_confidence * 100).toFixed(1)}%
        </Text>
      ),
    },
    {
      accessor: 'assigned_to',
      title: 'Assigned To',
      width: 120,
      render: (task: Task) => (
        <Text size="sm">
          {task.assigned_to || '-'}
        </Text>
      ),
    },
    {
      accessor: 'team_id',
      title: 'Team',
      width: 100,
    },
    {
      accessor: 'scan_date',
      title: 'Scan Date',
      width: 150,
      render: (task: Task) => (
        <Text size="sm">
          {new Date(task.scan_date).toLocaleDateString()}
        </Text>
      ),
    },
    {
      accessor: 'actions',
      title: 'Actions',
      width: 100,
      textAlign: 'center' as const,
      render: (task: Task) => (
        <Group gap="xs" justify="center">
          <Button
            size="xs"
            variant="subtle"
            onClick={() => {
              setSelectedTask(task);
              open();
            }}
            leftSection={<IconEye size={16} />}
          >
            View
          </Button>
        </Group>
      ),
    },
  ];

  // DataTable handles pagination internally, no need to slice
  const totalRecords = tasks.length;

  return (
    <Container size="xl" py="md">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={1}>Tasks</Title>
            {stats && (
              <Text size="sm" c="dimmed" mt="xs">
                {stats.total} total • {stats.pending} pending • {stats.in_progress} in progress • {stats.completed} completed
              </Text>
            )}
          </div>
          <Group>
            <Button
              variant="filled"
              leftSection={<IconUpload size={20} />}
              onClick={() => navigate('/import')}
            >
              Import CSV
            </Button>
            <Button
              variant="light"
              leftSection={<IconPlayerPlay size={20} />}
              onClick={handleGetNextTask}
            >
              Get Next Task
            </Button>
            <Button
              variant="subtle"
              leftSection={<IconRefresh size={20} />}
              onClick={() => refetch()}
            >
              Refresh
            </Button>
          </Group>
        </Group>

        {/* Filters */}
        <Card withBorder p="md">
          <Group align="flex-end">
            <Select
              label="Status"
              placeholder="All statuses"
              data={[
                { value: '', label: 'All statuses' },
                { value: 'pending', label: 'Pending' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'completed', label: 'Completed' },
                { value: 'failed', label: 'Failed' },
              ]}
              value={filter.status || ''}
              onChange={(value) => setFilter({ ...filter, status: value as Task['status'] || undefined })}
              clearable
              w={150}
            />

            <Select
              label="Type"
              placeholder="All types"
              data={[
                { value: '', label: 'All types' },
                { value: 'meal', label: 'Meal' },
                { value: 'label', label: 'Label' },
                { value: 'front_label', label: 'Front Label' },
                { value: 'screenshot', label: 'Screenshot' },
                { value: 'others', label: 'Others' },
              ]}
              value={filter.type || ''}
              onChange={(value) => setFilter({ ...filter, type: value as Task['type'] || undefined })}
              clearable
              w={150}
            />

            <Switch
              label="Assigned to me"
              checked={filter.assigned_to_me || false}
              onChange={(event) => setFilter({ ...filter, assigned_to_me: event.currentTarget.checked })}
            />

            <Switch
              label="Has end-user dislike"
              checked={filter.has_dislike || false}
              onChange={(event) => setFilter({ ...filter, has_dislike: event.currentTarget.checked })}
            />
          </Group>
        </Card>

        {/* Data Table */}
        <Card withBorder p={0}>
          {isLoading ? (
            <Center p="xl">
              <Loader />
            </Center>
          ) : (
            <DataTable
              striped
              highlightOnHover
              records={tasks}
              columns={columns}
              selectedRecords={selectedRecords}
              onSelectedRecordsChange={setSelectedRecords}
              totalRecords={totalRecords}
              recordsPerPage={PAGE_SIZE}
              page={page}
              onPageChange={setPage}
              paginationText={({ from, to, totalRecords }) =>
                `Showing ${from} to ${to} of ${totalRecords} tasks`
              }
              noRecordsText={tasks.length === 0 && !isLoading ? 'No tasks found' : ''}
              noRecordsIcon={<div />}
              minHeight={400}
            />
          )}
        </Card>
      </Stack>

      {/* Task Detail Drawer */}
      <Drawer
        opened={opened}
        onClose={close}
        title={<Text fw={600}>Task Details</Text>}
        position="right"
        size="xl"
        overlayProps={{ opacity: 0.5, blur: 4 }}
        scrollAreaComponent={ScrollArea.Autosize}
      >
        {selectedTask && (
          <Stack gap="md">
            {/* Basic Info */}
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
                Basic Information
              </Text>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>ID</Text>
                  <Code>{selectedTask.id}</Code>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" fw={500}>Request ID</Text>
                  <Code>{selectedTask.request_id}</Code>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" fw={500}>Status</Text>
                  <Badge color={getStatusColor(selectedTask.status)}>
                    {selectedTask.status.replace('_', ' ')}
                  </Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" fw={500}>Type</Text>
                  <Badge color={getTypeColor(selectedTask.type)}>
                    {selectedTask.type}
                  </Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" fw={500}>AI Confidence</Text>
                  <Text size="sm">{(selectedTask.ai_confidence * 100).toFixed(1)}%</Text>
                </Group>
              </Stack>
            </div>

            <Divider />

            {/* User & Team Info */}
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
                User & Team
              </Text>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>User ID</Text>
                  <Code>{selectedTask.user_id}</Code>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" fw={500}>Team ID</Text>
                  <Code>{selectedTask.team_id}</Code>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" fw={500}>Assigned To</Text>
                  <Text size="sm">{selectedTask.assigned_to || 'Unassigned'}</Text>
                </Group>
              </Stack>
            </div>

            <Divider />

            {/* User Input */}
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
                User Input
              </Text>
              <Code block>{selectedTask.user_input}</Code>
            </div>

            <Divider />

            {/* AI Output */}
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
                Raw AI Output
              </Text>
              <Code block style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(selectedTask.raw_ai_output, null, 2)}
              </Code>
            </div>

            <Divider />

            {/* Timestamps */}
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
                Timestamps
              </Text>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>Scan Date</Text>
                  <Text size="sm">{new Date(selectedTask.scan_date).toLocaleString()}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" fw={500}>Created At</Text>
                  <Text size="sm">{new Date(selectedTask.created_at).toLocaleString()}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" fw={500}>Updated At</Text>
                  <Text size="sm">{new Date(selectedTask.updated_at).toLocaleString()}</Text>
                </Group>
                {selectedTask.assigned_at && (
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>Assigned At</Text>
                    <Text size="sm">{new Date(selectedTask.assigned_at).toLocaleString()}</Text>
                  </Group>
                )}
              </Stack>
            </div>

            {/* Actions */}
            <Divider />
            <Group justify="flex-end">
              <Button variant="light" onClick={close}>
                Close
              </Button>
              <Button onClick={() => navigate(`/tasks/${selectedTask.id}`)}>
                Edit Task
              </Button>
            </Group>
          </Stack>
        )}
      </Drawer>
    </Container>
  );
}
