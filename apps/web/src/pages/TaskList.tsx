import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
  Table,
  Pagination,
  Menu,
  Checkbox,
  Avatar,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconRefresh, IconEye, IconPlayerPlay, IconUpload, IconColumns, IconPhoto } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { taskService } from '../services/task.service';
import { Task, TaskFilter, TaskListResponse } from '../types/task.types';

const PAGE_SIZE = 20;

const STATUS_COLOR_MAP: Record<Task['status'], string> = {
  pending: 'blue',
  in_progress: 'yellow',
  completed: 'green',
  failed: 'red',
};

const TYPE_COLOR_MAP: Record<Task['type'], string> = {
  meal: 'green',
  label: 'blue',
  front_label: 'cyan',
  screenshot: 'purple',
  others: 'gray',
};

const getStatusColor = (status: Task['status']) => STATUS_COLOR_MAP[status] ?? 'gray';
const getTypeColor = (type: Task['type']) => TYPE_COLOR_MAP[type] ?? 'gray';

type ColumnKey =
  | 'image_preview'
  | 'request_id'
  | 'type'
  | 'user_input'
  | 'status'
  | 'assigned_to'
  | 'created_at'
  | 'user_email'
  | 'user_full_name'
  | 'user_log'
  | 'is_logged'
  | 'edit_category'
  | 'logs'
  | 'raw_json';

interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  defaultVisible: boolean;
  render: (task: Task) => ReactNode;
}

const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  {
    key: 'image_preview',
    label: 'Image',
    defaultVisible: true,
    render: (task) => (
      <Tooltip label="Click to view task details">
        <Avatar
          src={task.user_input}
          alt="Task preview"
          radius="sm"
          size="md"
        >
          <IconPhoto size={20} />
        </Avatar>
      </Tooltip>
    ),
  },
  {
    key: 'request_id',
    label: 'Request ID',
    defaultVisible: true,
    render: (task) => (
      <Text size="sm" fw={500}>
        {task.request_id}
      </Text>
    ),
  },
  {
    key: 'type',
    label: 'Type',
    defaultVisible: true,
    render: (task) => (
      <Badge color={getTypeColor(task.type)} size="sm">
        {task.type}
      </Badge>
    ),
  },
  {
    key: 'user_input',
    label: 'User Input',
    defaultVisible: true,
    render: (task) => (
      <Text size="sm" maw={280} lineClamp={1} title={task.user_input}>
        {task.user_input}
      </Text>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    defaultVisible: true,
    render: (task) => (
      <Badge color={getStatusColor(task.status)} size="sm">
        {task.status.replace('_', ' ')}
      </Badge>
    ),
  },
  {
    key: 'assigned_to',
    label: 'Assigned To',
    defaultVisible: true,
    render: (task) => (
      <Text size="sm">{task.assigned_to || '-'}</Text>
    ),
  },
  {
    key: 'created_at',
    label: 'Created At',
    defaultVisible: true,
    render: (task) => (
      <Text size="sm">{new Date(task.created_at).toLocaleString()}</Text>
    ),
  },
  {
    key: 'user_email',
    label: 'User Email',
    defaultVisible: false,
    render: (task) => <Text size="sm">{task.user_email || '-'}</Text>,
  },
  {
    key: 'user_full_name',
    label: 'User Name',
    defaultVisible: false,
    render: (task) => <Text size="sm">{task.user_full_name || '-'}</Text>,
  },
  {
    key: 'user_log',
    label: 'User Log',
    defaultVisible: false,
    render: (task) => (
      <Text size="xs" c="dimmed" maw={280} lineClamp={1} title={task.user_log || ''}>
        {task.user_log || '-'}
      </Text>
    ),
  },
  {
    key: 'is_logged',
    label: 'Is Logged',
    defaultVisible: false,
    render: (task) => (
      <Badge color={task.is_logged ? 'green' : 'gray'} size="sm" variant="light">
        {task.is_logged ? 'Yes' : 'No'}
      </Badge>
    ),
  },
  {
    key: 'edit_category',
    label: 'Edit Category',
    defaultVisible: false,
    render: (task) => <Text size="sm">{task.edit_category || '-'}</Text>,
  },
  {
    key: 'logs',
    label: 'Logs',
    defaultVisible: false,
    render: (task) => (
      <Text size="xs" c="dimmed" maw={280} lineClamp={1} title={task.logs || ''}>
        {task.logs || '-'}
      </Text>
    ),
  },
  {
    key: 'raw_json',
    label: 'Raw JSON',
    defaultVisible: false,
    render: (task) => {
      const value = typeof task.raw_json === 'string' ? task.raw_json : task.raw_json ? JSON.stringify(task.raw_json) : task.raw_ai_output;
      return (
        <Text size="xs" c="dimmed" maw={280} lineClamp={1} title={value || ''}>
          {value || '-'}
        </Text>
      );
    },
  },
];

const DEFAULT_VISIBLE_COLUMNS = COLUMN_DEFINITIONS.filter((column) => column.defaultVisible).map(
  (column) => column.key
);

const getColumnStorageKey = (userId: string) => `task-list-columns:${userId || 'anonymous'}`;

export function TaskList() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<TaskFilter>({});
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [page, setPage] = useState(1);
  const currentUser = 'user123';
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(getColumnStorageKey(currentUser));
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as ColumnKey[];
          const validKeys = new Set(COLUMN_DEFINITIONS.map((column) => column.key));
          const filtered = parsed.filter((key): key is ColumnKey => validKeys.has(key));
          if (filtered.length > 0) {
            return COLUMN_DEFINITIONS.filter((column) => filtered.includes(column.key)).map(
              (column) => column.key
            );
          }
        } catch (error) {
          console.warn('Failed to parse column preferences, falling back to defaults', error);
        }
      }
    }
    return DEFAULT_VISIBLE_COLUMNS;
  });

  const updateFilter = (changes: Partial<TaskFilter>) => {
    setFilter((prev) => ({ ...prev, ...changes }));
    setPage(1);
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(
      getColumnStorageKey(currentUser),
      JSON.stringify(visibleColumns)
    );
  }, [visibleColumns, currentUser]);

  const visibleColumnDefinitions = useMemo(() => {
    const active = new Set(visibleColumns);
    return COLUMN_DEFINITIONS.filter((column) => active.has(column.key));
  }, [visibleColumns]);

  const handleToggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => {
      const hasColumn = prev.includes(key);
      if (hasColumn) {
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((column) => column !== key);
      }
      const next = [...prev, key];
      return COLUMN_DEFINITIONS.filter((column) => next.includes(column.key)).map(
        (column) => column.key
      );
    });
  };

  // Fetch tasks
  const { data: tasksData, isLoading, isFetching, refetch } = useQuery<TaskListResponse>({
    queryKey: ['tasks', filter, page],
    queryFn: () =>
      taskService.getTasks({
        ...filter,
        assigned_to_me: filter.assigned_to_me ? true : undefined,
        has_dislike: filter.has_dislike ? true : undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
    placeholderData: (previousData) => previousData,
  });

  const tasks = tasksData?.tasks ?? [];
  const serverPagination = tasksData?.pagination;
  const totalRecords = serverPagination?.total ?? tasks.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const fromRecord = totalRecords === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toRecord = totalRecords === 0 ? 0 : Math.min(totalRecords, page * PAGE_SIZE);
  const showInitialLoader = isLoading && tasks.length === 0;
  const noDataColSpan = Math.max(1, visibleColumnDefinitions.length) + 1;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
            <Menu width={220} withinPortal>
              <Menu.Target>
                <Button variant="light" leftSection={<IconColumns size={20} />}>
                  Columns
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Stack gap="xs" p="xs">
                  {COLUMN_DEFINITIONS.map((column) => {
                    const isChecked = visibleColumns.includes(column.key);
                    const disableToggle = isChecked && visibleColumns.length === 1;
                    return (
                      <Checkbox
                        key={column.key}
                        label={column.label}
                        checked={isChecked}
                        onChange={() => handleToggleColumn(column.key)}
                        disabled={disableToggle}
                      />
                    );
                  })}
                </Stack>
              </Menu.Dropdown>
            </Menu>
            <Button
              variant="subtle"
              leftSection={<IconRefresh size={20} />}
              onClick={() => refetch()}
              loading={isFetching && !isLoading}
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
              onChange={(value) =>
                updateFilter({ status: value ? (value as Task['status']) : undefined })
              }
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
              onChange={(value) =>
                updateFilter({ type: value ? (value as Task['type']) : undefined })
              }
              clearable
              w={150}
            />

            <Switch
              label="Assigned to me"
              checked={filter.assigned_to_me || false}
              onChange={(event) =>
                updateFilter({ assigned_to_me: event.currentTarget.checked ? true : undefined })
              }
            />

            <Switch
              label="Has end-user dislike"
              checked={filter.has_dislike || false}
              onChange={(event) =>
                updateFilter({ has_dislike: event.currentTarget.checked ? true : undefined })
              }
            />
          </Group>
        </Card>

        {/* Data Table */}
        <Card withBorder p={0}>
          {showInitialLoader ? (
            <Center p="xl">
              <Loader />
            </Center>
          ) : (
            <>
              <ScrollArea style={{ minHeight: 400 }}>
                <Table striped highlightOnHover withTableBorder withColumnBorders verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      {visibleColumnDefinitions.map((column) => (
                        <Table.Th key={column.key}>{column.label}</Table.Th>
                      ))}
                      <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {tasks.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={noDataColSpan}>
                          <Center py="xl">
                            <Text c="dimmed">No tasks found</Text>
                          </Center>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      tasks.map((task) => (
                        <Table.Tr key={task.id}>
                          {visibleColumnDefinitions.map((column) => (
                            <Table.Td key={column.key}>{column.render(task)}</Table.Td>
                          ))}
                          <Table.Td>
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
                          </Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              <Group justify="space-between" align="center" px="md" py="sm">
                <Text size="sm" c="dimmed">
                  {`Showing ${fromRecord} to ${toRecord} of ${totalRecords} tasks`}
                </Text>
                <Group gap="sm" align="center">
                  {isFetching && !isLoading && <Loader size="sm" />}
                  <Pagination
                    total={totalPages}
                    value={page}
                    onChange={setPage}
                    disabled={isLoading || totalRecords === 0}
                  />
                </Group>
              </Group>
            </>
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
        padding="md"
        radius="md"
        offset={8}
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
                {selectedTask.user_email && (
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>User Email</Text>
                    <Text size="sm">{selectedTask.user_email}</Text>
                  </Group>
                )}
                {selectedTask.user_full_name && (
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>User Name</Text>
                    <Text size="sm">{selectedTask.user_full_name}</Text>
                  </Group>
                )}
                <Group justify="space-between">
                  <Text size="sm" fw={500}>Team ID</Text>
                  <Code>{selectedTask.team_id}</Code>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" fw={500}>Assigned To</Text>
                  <Text size="sm">{selectedTask.assigned_to || 'Unassigned'}</Text>
                </Group>
                {selectedTask.is_logged !== null && selectedTask.is_logged !== undefined && (
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>Is Logged</Text>
                    <Badge color={selectedTask.is_logged ? 'green' : 'gray'} size="sm" variant="light">
                      {selectedTask.is_logged ? 'Yes' : 'No'}
                    </Badge>
                  </Group>
                )}
              </Stack>
            </div>

            <Divider />

            {/* User Logs & Categories (if present) */}
            {(selectedTask.user_log || selectedTask.edit_category || selectedTask.raw_user_log) && (
              <>
                <Divider />
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
                    User Logs & Categories
                  </Text>
                  <Stack gap="xs">
                    {selectedTask.edit_category && (
                      <Group justify="space-between">
                        <Text size="sm" fw={500}>Edit Category</Text>
                        <Badge size="sm">{selectedTask.edit_category}</Badge>
                      </Group>
                    )}
                    {selectedTask.user_log && (
                      <>
                        <Text size="sm" fw={500}>User Log</Text>
                        <Code block style={{ whiteSpace: 'pre-wrap', fontSize: '11px' }}>
                          {selectedTask.user_log}
                        </Code>
                      </>
                    )}
                    {selectedTask.raw_user_log && (
                      <>
                        <Text size="sm" fw={500}>Raw User Log</Text>
                        <Code block style={{ whiteSpace: 'pre-wrap', fontSize: '11px' }}>
                          {selectedTask.raw_user_log}
                        </Code>
                      </>
                    )}
                  </Stack>
                </div>
              </>
            )}

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
