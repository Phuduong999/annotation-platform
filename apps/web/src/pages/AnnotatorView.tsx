import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Card,
  Title,
  Text,
  Image,
  Stack,
  Group,
  Button,
  Select,
  Textarea,
  Badge,
  Progress,
  ScrollArea,
  Loader,
  Center,
  Divider,
  ActionIcon,
  Tooltip,
  Paper,
  Modal,
  Kbd,
  Collapse,
  SegmentedControl,
  Box,
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useHotkeys, useDisclosure } from '@mantine/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconZoomIn,
  IconCheck,
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconKeyboard,
  IconAlertTriangle,
  IconChevronDown,
  IconChevronUp,
  IconInfoCircle,
} from '@tabler/icons-react';
import { taskService } from '../services/task.service';
import { TaskAnnotation } from '../types/task.types';

export function AnnotatorView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [imageModalOpened, setImageModalOpened] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [aiOutputExpanded, { toggle: toggleAiOutput }] = useDisclosure(false);
  const [shortcutsVisible, { toggle: toggleShortcuts }] = useDisclosure(false);

  // Fetch task data
  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => taskService.getTask(id!),
    enabled: !!id,
  });

  // Form setup with quick defaults
  const form = useForm<TaskAnnotation>({
    initialValues: {
      scan_type_judgement: '',
      result_return_judgement: '',
      corrected_type: '',
      notes: '',
    },
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: (data: TaskAnnotation) => taskService.submitAnnotation(id!, data),
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: 'Annotation submitted successfully',
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      // Auto-navigate to next task
      handleNextTask();
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to submit annotation',
        color: 'red',
      });
    },
  });

  const handleSubmit = () => {
    if (!form.values.scan_type_judgement || !form.values.result_return_judgement) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill all required fields',
        color: 'orange',
      });
      return;
    }
    submitMutation.mutate(form.values);
  };

  // Quick action handlers
  const handleQuickCorrect = () => {
    form.setValues({
      scan_type_judgement: 'correct_type',
      result_return_judgement: 'result_return',
    });
  };

  const handleQuickWrong = () => {
    form.setValues({
      scan_type_judgement: 'wrong_type',
      result_return_judgement: 'no_result_return',
    });
  };

  const handleNextTask = () => {
    // TODO: Get next task from API
    navigate('/tasks');
  };

  const handlePreviousTask = () => {
    // TODO: Get previous task from API
    navigate('/tasks');
  };

  // Keyboard shortcuts
  useHotkeys('1', () => form.setFieldValue('scan_type_judgement', 'correct_type'));
  useHotkeys('2', () => form.setFieldValue('scan_type_judgement', 'wrong_type'));
  useHotkeys('3', () => form.setFieldValue('result_return_judgement', 'result_return'));
  useHotkeys('4', () => form.setFieldValue('result_return_judgement', 'no_result_return'));
  useHotkeys('ctrl+enter, cmd+enter', (e) => {
    e.preventDefault();
    handleSubmit();
  });
  useHotkeys('ctrl+n, cmd+n', (e) => {
    e.preventDefault();
    handleNextTask();
  });
  useHotkeys('ctrl+p, cmd+p', (e) => {
    e.preventDefault();
    handlePreviousTask();
  });
  useHotkeys('z', () => setImageModalOpened(true));
  useHotkeys('?', (e) => {
    e.preventDefault();
    toggleShortcuts();
  });

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!task) {
    return (
      <Center h="100vh">
        <Stack align="center">
          <Text size="lg">Task not found</Text>
          <Button onClick={() => navigate('/tasks')}>Back to Tasks</Button>
        </Stack>
      </Center>
    );
  }

  const progress = 45; // TODO: Calculate from API

  return (
    <Container fluid h="100vh" p={0} style={{ overflow: 'hidden' }}>
      <Grid h="100%" m={0} gutter={0}>
        {/* Main Area - Image (70%) */}
        <Grid.Col span={8.5} h="100%" style={{ position: 'relative', backgroundColor: '#f8f9fa' }}>
          <Stack h="100%" gap={0}>
            {/* Top Bar */}
            <Paper p="sm" shadow="xs">
              <Group justify="space-between">
                <Group gap="xs">
                  <ActionIcon
                    variant="subtle"
                    onClick={handlePreviousTask}
                    size="lg"
                  >
                    <IconChevronLeft size={20} />
                  </ActionIcon>
                  <Stack gap={0}>
                    <Text size="xs" c="dimmed">Task ID</Text>
                    <Text size="sm" fw={500}>{task.request_id}</Text>
                  </Stack>
                  <ActionIcon
                    variant="subtle"
                    onClick={handleNextTask}
                    size="lg"
                  >
                    <IconChevronRight size={20} />
                  </ActionIcon>
                </Group>

                <Group gap="xs">
                  <Badge color="blue" size="lg">{task.type}</Badge>
                  <Badge color="gray" size="lg">{task.status}</Badge>
                  <Tooltip label="Zoom (Z)">
                    <ActionIcon
                      variant="filled"
                      onClick={() => setImageModalOpened(true)}
                      disabled={imageError}
                      size="lg"
                    >
                      <IconZoomIn size={20} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Shortcuts (?)">
                    <ActionIcon
                      variant="light"
                      onClick={toggleShortcuts}
                      size="lg"
                    >
                      <IconKeyboard size={20} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>

              {/* Progress Bar */}
              <Box mt="xs">
                <Group justify="space-between" mb={4}>
                  <Text size="xs" c="dimmed">Session Progress</Text>
                  <Text size="xs" fw={500}>{progress}% (9/20 tasks)</Text>
                </Group>
                <Progress value={progress} size="sm" radius="xl" />
              </Box>
            </Paper>

            {/* Image Display Area */}
            <Box style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              {imageError ? (
                <Alert icon={<IconAlertTriangle />} color="red" title="Image Load Error">
                  Failed to load image. Please check the URL or try refreshing.
                </Alert>
              ) : (
                <Image
                  src={task.user_input}
                  alt="Task image"
                  fit="contain"
                  style={{
                    maxHeight: '100%',
                    maxWidth: '100%',
                    cursor: 'zoom-in',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    borderRadius: 8,
                  }}
                  onError={() => setImageError(true)}
                  onClick={() => setImageModalOpened(true)}
                />
              )}
            </Box>

            {/* AI Output - Expandable */}
            <Paper shadow="md">
              <Group
                p="xs"
                style={{ cursor: 'pointer', backgroundColor: '#fff' }}
                onClick={toggleAiOutput}
                justify="space-between"
              >
                <Group gap="xs">
                  <ActionIcon variant="subtle" size="sm">
                    {aiOutputExpanded ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
                  </ActionIcon>
                  <Text size="sm" fw={500}>AI Analysis</Text>
                  <Badge size="sm" color="cyan">Nutrition Data</Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  {aiOutputExpanded ? 'Click to collapse' : 'Click to expand'}
                </Text>
              </Group>
              <Collapse in={aiOutputExpanded}>
                <ScrollArea h={200} p="sm" style={{ backgroundColor: '#f8f9fa' }}>
                  <Text size="xs" style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(task.raw_ai_output, null, 2)}
                  </Text>
                </ScrollArea>
              </Collapse>
            </Paper>
          </Stack>
        </Grid.Col>

        {/* Sidebar - Annotation Panel (30%) */}
        <Grid.Col span={3.5} h="100%" style={{ backgroundColor: '#fff', borderLeft: '1px solid #dee2e6' }}>
          <ScrollArea h="100%">
            <Stack p="md" gap="lg">
              <div>
                <Title order={3} mb="xs">Quick Annotation</Title>
                <Text size="sm" c="dimmed">
                  Label this food image quickly and accurately
                </Text>
              </div>

              {/* Quick Action Buttons */}
              <Card withBorder p="md" bg="gray.0">
                <Text size="sm" fw={500} mb="sm">Quick Actions</Text>
                <Stack gap="xs">
                  <Button
                    fullWidth
                    variant="light"
                    color="green"
                    leftSection={<IconCheck size={18} />}
                    onClick={handleQuickCorrect}
                  >
                    ✓ Correct & Complete
                  </Button>
                  <Button
                    fullWidth
                    variant="light"
                    color="red"
                    leftSection={<IconX size={18} />}
                    onClick={handleQuickWrong}
                  >
                    ✗ Wrong Type / No Result
                  </Button>
                </Stack>
              </Card>

              <Divider />

              {/* Annotation Form */}
              <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                <Stack gap="md">
                  <div>
                    <Text size="sm" fw={500} mb="xs">
                      Scan Type Judgement <Text component="span" c="red">*</Text>
                    </Text>
                    <SegmentedControl
                      fullWidth
                      value={form.values.scan_type_judgement}
                      onChange={(value) => form.setFieldValue('scan_type_judgement', value)}
                      data={[
                        { label: '✓ Correct', value: 'correct_type' },
                        { label: '✗ Wrong', value: 'wrong_type' },
                      ]}
                    />
                    <Text size="xs" c="dimmed" mt={4}>
                      Press <Kbd>1</Kbd> for Correct, <Kbd>2</Kbd> for Wrong
                    </Text>
                  </div>

                  <div>
                    <Text size="sm" fw={500} mb="xs">
                      Result Return Judgement <Text component="span" c="red">*</Text>
                    </Text>
                    <SegmentedControl
                      fullWidth
                      value={form.values.result_return_judgement}
                      onChange={(value) => form.setFieldValue('result_return_judgement', value)}
                      data={[
                        { label: '✓ Return', value: 'result_return' },
                        { label: '✗ No Return', value: 'no_result_return' },
                      ]}
                    />
                    <Text size="xs" c="dimmed" mt={4}>
                      Press <Kbd>3</Kbd> for Return, <Kbd>4</Kbd> for No Return
                    </Text>
                  </div>

                  <Select
                    label="Corrected Type (if wrong)"
                    placeholder="Select correct type"
                    data={[
                      { value: 'meal', label: 'Meal' },
                      { value: 'label', label: 'Label' },
                      { value: 'front_label', label: 'Front Label' },
                      { value: 'screenshot', label: 'Screenshot' },
                      { value: 'others', label: 'Others' },
                    ]}
                    value={form.values.corrected_type}
                    onChange={(value) => form.setFieldValue('corrected_type', value || '')}
                    clearable
                  />

                  <Textarea
                    label="Notes (optional)"
                    placeholder="Add any additional comments..."
                    value={form.values.notes}
                    onChange={(e) => form.setFieldValue('notes', e.target.value)}
                    minRows={3}
                    maxRows={6}
                  />

                  <Button
                    type="submit"
                    size="lg"
                    fullWidth
                    loading={submitMutation.isPending}
                    rightSection={<Text size="sm">Ctrl+Enter</Text>}
                  >
                    Submit & Next
                  </Button>
                </Stack>
              </form>

              {/* Annotation Guide */}
              <Card withBorder p="sm" bg="blue.0">
                <Group gap="xs" mb="xs">
                  <IconInfoCircle size={16} />
                  <Text size="sm" fw={500}>Annotation Guide</Text>
                </Group>
                <Stack gap="xs">
                  <div>
                    <Text size="xs" fw={500}>Meal</Text>
                    <Text size="xs" c="dimmed">Prepared food requiring nutrition estimation</Text>
                  </div>
                  <div>
                    <Text size="xs" fw={500}>Label</Text>
                    <Text size="xs" c="dimmed">Nutrition facts or packaging text</Text>
                  </div>
                  <div>
                    <Text size="xs" fw={500}>Front Label</Text>
                    <Text size="xs" c="dimmed">Marketing claims on packaging</Text>
                  </div>
                </Stack>
              </Card>

              {/* User Info */}
              {(task.user_email || task.user_full_name) && (
                <Card withBorder p="sm">
                  <Text size="xs" fw={500} mb="xs">User Info</Text>
                  <Stack gap={4}>
                    {task.user_full_name && (
                      <Text size="xs">{task.user_full_name}</Text>
                    )}
                    {task.user_email && (
                      <Text size="xs" c="dimmed">{task.user_email}</Text>
                    )}
                  </Stack>
                </Card>
              )}
            </Stack>
          </ScrollArea>
        </Grid.Col>
      </Grid>

      {/* Image Full-Screen Modal */}
      <Modal
        opened={imageModalOpened}
        onClose={() => setImageModalOpened(false)}
        size="100%"
        fullScreen
        title={`Task: ${task.request_id}`}
      >
        <Image
          src={task?.user_input}
          alt="Task image full-screen"
          fit="contain"
          h="90vh"
        />
      </Modal>

      {/* Keyboard Shortcuts Modal */}
      <Modal
        opened={shortcutsVisible}
        onClose={toggleShortcuts}
        title="Keyboard Shortcuts"
        size="md"
      >
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm">Correct Type</Text>
            <Kbd>1</Kbd>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Wrong Type</Text>
            <Kbd>2</Kbd>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Result Return</Text>
            <Kbd>3</Kbd>
          </Group>
          <Group justify="space-between">
            <Text size="sm">No Result Return</Text>
            <Kbd>4</Kbd>
          </Group>
          <Divider />
          <Group justify="space-between">
            <Text size="sm">Zoom Image</Text>
            <Kbd>Z</Kbd>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Submit & Next</Text>
            <Group gap={4}>
              <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd>
            </Group>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Next Task</Text>
            <Group gap={4}>
              <Kbd>Ctrl</Kbd>+<Kbd>N</Kbd>
            </Group>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Previous Task</Text>
            <Group gap={4}>
              <Kbd>Ctrl</Kbd>+<Kbd>P</Kbd>
            </Group>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Show Shortcuts</Text>
            <Kbd>?</Kbd>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
