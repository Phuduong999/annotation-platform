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
  TagsInput,
  Alert,
  Badge,
  ScrollArea,
  Loader,
  Center,
  Divider,
  ActionIcon,
  Tooltip,
  Paper,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useHotkeys } from 'react-hotkeys-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconDeviceFloppy,
  IconSend,
  IconPlayerSkipForward,
  IconArrowLeft,
  IconAlertTriangle,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { taskService } from '../services/task.service';
import { TaskAnnotation, ParsedAIOutput } from '../types/task.types';
import { parseAIOutput, formatAIOutputDisplay, validateNutrition } from '../utils/nutrition.utils';

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [imageError, setImageError] = useState(false);

  // Fetch task data
  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => taskService.getTask(id!),
    enabled: !!id,
  });

  // Parse AI output
  const parsedAI = useMemo<ParsedAIOutput>(() => {
    if (!task?.raw_ai_output) return {};
    return parseAIOutput(task.raw_ai_output);
  }, [task?.raw_ai_output]);

  // Format AI output for display
  const aiDisplayLines = useMemo(() => {
    return formatAIOutputDisplay(parsedAI);
  }, [parsedAI]);

  // Nutrition validation
  const nutritionValidation = useMemo(() => {
    if (!parsedAI.nutrition) return null;
    return validateNutrition(parsedAI.nutrition);
  }, [parsedAI.nutrition]);

  // Form setup
  const form = useForm<TaskAnnotation>({
    initialValues: {
      classification: 'safe' as TaskAnnotation['classification'],
      tags: [],
      feedback: '',
      nutrition: parsedAI.nutrition,
    },
    validate: {
      classification: (value) => {
        if (!value) return 'Classification is required';
        const validValues = ['explicit', 'adult', 'suggestive', 'medical', 'safe'];
        if (!validValues.includes(value)) return 'Invalid classification';
        return null;
      },
      feedback: (value) => {
        if (value && value.length > 1000) return 'Feedback too long (max 1000 characters)';
        return null;
      },
    },
  });

  // Update form when task loads
  useEffect(() => {
    if (task?.result) {
      const classification = (task.result.classification || parsedAI.classification || 'safe') as TaskAnnotation['classification'];
      form.setValues({
        classification,
        tags: task.result.tags || [],
        feedback: task.result.feedback || '',
        nutrition: task.result.nutrition || parsedAI.nutrition,
      });
    } else if (parsedAI.classification) {
      const validClassifications: TaskAnnotation['classification'][] = ['explicit', 'adult', 'suggestive', 'medical', 'safe'];
      const classification = validClassifications.includes(parsedAI.classification as any) 
        ? parsedAI.classification as TaskAnnotation['classification']
        : 'safe';
      form.setFieldValue('classification', classification);
    }
  }, [task, parsedAI]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (data: TaskAnnotation) => taskService.saveTaskAnnotation(id!, data),
    onSuccess: () => {
      notifications.show({
        title: 'Saved',
        message: 'Task annotation saved successfully',
        color: 'green',
        icon: <IconCheck />,
      });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to save task annotation',
        color: 'red',
        icon: <IconX />,
      });
    },
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: (data: TaskAnnotation) => taskService.submitTask(id!, data),
    onSuccess: () => {
      notifications.show({
        title: 'Submitted',
        message: 'Task completed successfully',
        color: 'green',
        icon: <IconCheck />,
      });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      // Navigate to next task
      handleGetNextTask();
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to submit task',
        color: 'red',
        icon: <IconX />,
      });
    },
  });

  // Skip mutation
  const skipMutation = useMutation({
    mutationFn: (reason?: string) => taskService.skipTask(id!, reason),
    onSuccess: () => {
      notifications.show({
        title: 'Skipped',
        message: 'Task skipped',
        color: 'yellow',
      });
      handleGetNextTask();
    },
  });

  // Get next task
  const handleGetNextTask = async () => {
    try {
      const nextTask = await taskService.getNextTask('user123'); // Mock user
      if (nextTask) {
        navigate(`/tasks/${nextTask.id}`);
      } else {
        navigate('/tasks');
      }
    } catch (error) {
      navigate('/tasks');
    }
  };

  // Handlers
  const handleSave = () => {
    const validation = form.validate();
    if (validation.hasErrors) return;
    saveMutation.mutate(form.values);
  };

  const handleSubmit = () => {
    const validation = form.validate();
    if (validation.hasErrors) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fix the form errors before submitting',
        color: 'red',
      });
      return;
    }

    // Check nutrition validation if applicable
    if (nutritionValidation && !nutritionValidation.isValid) {
      modals.openConfirmModal({
        title: 'Nutrition Warning',
        children: (
          <Stack gap="sm">
            <Text size="sm">There are nutrition validation warnings:</Text>
            {nutritionValidation.warnings.map((warning, idx) => (
              <Alert key={idx} color="yellow" icon={<IconAlertTriangle />}>
                {warning}
              </Alert>
            ))}
            <Text size="sm">Do you want to submit anyway?</Text>
          </Stack>
        ),
        labels: { confirm: 'Submit Anyway', cancel: 'Cancel' },
        confirmProps: { color: 'red' },
        onConfirm: () => submitMutation.mutate(form.values),
      });
    } else {
      submitMutation.mutate(form.values);
    }
  };

  const handleSkip = () => {
    modals.openConfirmModal({
      title: 'Skip Task',
      children: (
        <Stack gap="sm">
          <Text size="sm">Are you sure you want to skip this task?</Text>
          <Textarea
            placeholder="Reason for skipping (optional)"
            id="skip-reason"
          />
        </Stack>
      ),
      labels: { confirm: 'Skip', cancel: 'Cancel' },
      confirmProps: { color: 'yellow' },
      onConfirm: () => {
        const reason = (document.getElementById('skip-reason') as HTMLTextAreaElement)?.value;
        skipMutation.mutate(reason);
      },
    });
  };

  // Hotkeys
  useHotkeys('ctrl+s, cmd+s', (e) => {
    e.preventDefault();
    handleSave();
  });

  useHotkeys('ctrl+enter, cmd+enter', (e) => {
    e.preventDefault();
    handleSubmit();
  });

  useHotkeys('ctrl+shift+s, cmd+shift+s', (e) => {
    e.preventDefault();
    handleSkip();
  });

  useHotkeys('1', () => form.setFieldValue('classification', 'safe'));
  useHotkeys('2', () => form.setFieldValue('classification', 'suggestive'));
  useHotkeys('3', () => form.setFieldValue('classification', 'adult'));
  useHotkeys('4', () => form.setFieldValue('classification', 'explicit'));
  useHotkeys('5', () => form.setFieldValue('classification', 'medical'));

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

  return (
    <Container fluid h="100vh" p="md">
      <Stack h="100%" gap="md">
        {/* Header */}
        <Card withBorder p="sm">
          <Group justify="space-between" align="center">
            <Group>
              <ActionIcon variant="subtle" onClick={() => navigate('/tasks')}>
                <IconArrowLeft />
              </ActionIcon>
              <Title order={3}>Task Annotation</Title>
              <Badge color={task.status === 'in_progress' ? 'yellow' : 'blue'}>
                {task.status.replace('_', ' ')}
              </Badge>
              <Text size="sm" c="dimmed">
                ID: {task.id.slice(0, 8)}...
              </Text>
            </Group>
            <Group>
              <Text size="xs" c="dimmed">
                Hotkeys: 1-5 (classification) • ⌘+S (save) • ⌘+Enter (submit) • ⌘+Shift+S (skip)
              </Text>
            </Group>
          </Group>
        </Card>

        {/* Main Content */}
        <Grid h="calc(100% - 80px)" gutter="md">
          {/* Left Panel - Image */}
          <Grid.Col span={4}>
            <Card h="100%" withBorder p="md">
              <Stack h="100%">
                <Title order={4}>Image</Title>
                <Divider />
                <ScrollArea h="100%" type="auto">
                  {imageError ? (
                    <Alert color="red" icon={<IconAlertTriangle />}>
                      Failed to load image
                    </Alert>
                  ) : (
                    <Image
                      src={task.user_input}
                      alt="Task image"
                      fit="contain"
                      onError={() => setImageError(true)}
                      radius="md"
                    />
                  )}
                  <Stack gap="xs" mt="md">
                    <Text size="xs" c="dimmed">URL:</Text>
                    <Text size="xs" style={{ wordBreak: 'break-all' }}>
                      {task.user_input}
                    </Text>
                  </Stack>
                </ScrollArea>
              </Stack>
            </Card>
          </Grid.Col>

          {/* Middle Panel - AI Output */}
          <Grid.Col span={4}>
            <Card h="100%" withBorder p="md">
              <Stack h="100%">
                <Title order={4}>AI Analysis</Title>
                <Divider />
                <ScrollArea h="100%" type="auto">
                  <Stack gap="sm">
                    {aiDisplayLines.map((line, idx) => {
                      if (line.startsWith('**') && line.endsWith('**')) {
                        return (
                          <Text key={idx} fw={600} size="sm">
                            {line.replace(/\*\*/g, '')}
                          </Text>
                        );
                      } else if (line.startsWith('  •')) {
                        return (
                          <Text key={idx} size="sm" pl="md">
                            {line}
                          </Text>
                        );
                      } else if (line.startsWith('  ')) {
                        return (
                          <Text key={idx} size="sm" pl="md" c="dimmed">
                            {line}
                          </Text>
                        );
                      } else if (line === '') {
                        return <Divider key={idx} my="xs" />;
                      } else {
                        return (
                          <Text key={idx} size="sm">
                            {line}
                          </Text>
                        );
                      }
                    })}

                    {/* Nutrition Warnings */}
                    {nutritionValidation && !nutritionValidation.isValid && (
                      <Alert color="yellow" icon={<IconAlertTriangle />} mt="md">
                        <Stack gap="xs">
                          <Text size="sm" fw={500}>Nutrition Validation Warnings:</Text>
                          {nutritionValidation.warnings.map((warning, idx) => (
                            <Text key={idx} size="xs">{warning}</Text>
                          ))}
                        </Stack>
                      </Alert>
                    )}
                  </Stack>
                </ScrollArea>
              </Stack>
            </Card>
          </Grid.Col>

          {/* Right Panel - Annotation Form */}
          <Grid.Col span={4}>
            <Card h="100%" withBorder p="md">
              <Stack h="100%" justify="space-between">
                <Stack>
                  <Title order={4}>Annotation</Title>
                  <Divider />
                  
                  <form>
                    <Stack gap="md">
                      {/* Classification */}
                      <Select
                        label="Classification"
                        placeholder="Select classification"
                        data={[
                          { value: 'safe', label: 'Safe (1)' },
                          { value: 'suggestive', label: 'Suggestive (2)' },
                          { value: 'adult', label: 'Adult (3)' },
                          { value: 'explicit', label: 'Explicit (4)' },
                          { value: 'medical', label: 'Medical (5)' },
                        ]}
                        {...form.getInputProps('classification')}
                        required
                        error={form.errors.classification}
                      />

                      {/* Tags */}
                      <TagsInput
                        label="Tags"
                        placeholder="Enter tags"
                        {...form.getInputProps('tags')}
                        clearable
                      />

                      {/* Feedback */}
                      <Textarea
                        label="Feedback"
                        placeholder="Additional notes or corrections"
                        rows={4}
                        {...form.getInputProps('feedback')}
                        error={form.errors.feedback}
                      />

                      {/* Task Metadata */}
                      <Paper p="sm" withBorder>
                        <Stack gap="xs">
                          <Text size="xs" fw={500}>Task Info:</Text>
                          <Text size="xs">Team: {task.team_id}</Text>
                          <Text size="xs">Type: {task.type}</Text>
                          <Text size="xs">Confidence: {(task.ai_confidence * 100).toFixed(1)}%</Text>
                          <Text size="xs">Date: {new Date(task.scan_date).toLocaleString()}</Text>
                        </Stack>
                      </Paper>
                    </Stack>
                  </form>
                </Stack>

                {/* Action Buttons */}
                <Stack gap="sm">
                  <Group grow>
                    <Tooltip label="Save draft (⌘+S)">
                      <Button
                        variant="light"
                        leftSection={<IconDeviceFloppy size={20} />}
                        onClick={handleSave}
                        loading={saveMutation.isPending}
                      >
                        Save
                      </Button>
                    </Tooltip>
                    <Tooltip label="Submit and next (⌘+Enter)">
                      <Button
                        variant="filled"
                        leftSection={<IconSend size={20} />}
                        onClick={handleSubmit}
                        loading={submitMutation.isPending}
                        disabled={!form.values.classification}
                      >
                        Submit
                      </Button>
                    </Tooltip>
                  </Group>
                  <Tooltip label="Skip task (⌘+Shift+S)">
                    <Button
                      variant="subtle"
                      color="yellow"
                      leftSection={<IconPlayerSkipForward size={20} />}
                      onClick={handleSkip}
                      loading={skipMutation.isPending}
                    >
                      Skip Task
                    </Button>
                  </Tooltip>
                </Stack>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}