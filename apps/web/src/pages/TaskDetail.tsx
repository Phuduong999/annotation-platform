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
  MultiSelect,
  Textarea,
  Alert,
  Badge,
  ScrollArea,
  Loader,
  Center,
  Divider,
  ActionIcon,
  Tooltip,
  Paper,
  Modal,
  CopyButton,
  Code,
  Radio,
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
  IconZoomIn,
  IconCopy,
  IconInfoCircle,
} from '@tabler/icons-react';
import { taskService } from '../services/task.service';
import { TaskAnnotation, ParsedAIOutput } from '../types/task.types';
import { parseAIOutput, formatAIOutputDisplay, validateNutrition } from '../utils/nutrition.utils';
import { EndUserFeedback } from '../components/EndUserFeedback';

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [imageError, setImageError] = useState(false);
  const [imageModalOpened, setImageModalOpened] = useState(false);

  // Fetch task data
  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => taskService.getTask(id!),
    enabled: !!id,
  });

  // Auto-start task when loaded if status is pending
  const startTaskMutation = useMutation({
    mutationFn: () => taskService.startTask(id!, 'user123'), // Mock user ID
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', id] });
    },
  });

  useEffect(() => {
    if (task && (task.status === 'pending' || task.status === 'assigned')) {
      startTaskMutation.mutate();
    }
  }, [task?.id, task?.status]);

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

  // Check if AI output is empty (no result)
  const isEmptyAIOutput = useMemo(() => {
    if (!parsedAI) return true;
    const hasEmptyNameFood = parsedAI.name_food === '' || !parsedAI.name_food;
    const hasEmptyNutrition = !parsedAI.nutrition || (Array.isArray(parsedAI.nutrition) && parsedAI.nutrition.length === 0);
    const hasEmptyIngredients = !parsedAI.ingredients || (Array.isArray(parsedAI.ingredients) && parsedAI.ingredients.length === 0);
    return hasEmptyNameFood && hasEmptyNutrition && hasEmptyIngredients;
  }, [parsedAI]);

  // Form setup
  const form = useForm<TaskAnnotation>({
    initialValues: {
      classification: 'others' as TaskAnnotation['classification'],
      nutrition: parsedAI.nutrition,
      result_return_judgement: isEmptyAIOutput ? 'no_result_return' : 'result_return',
      feedback_correction: [],
    },
    validate: {
      classification: (value) => {
        if (!value) return 'Classification is required';
        const validValues = ['meal', 'label', 'front_label', 'screenshot', 'others'];
        if (!validValues.includes(value)) return 'Invalid classification';
        return null;
      },
      result_return_judgement: (value) => !value ? 'Result return judgement is required' : null,
    },
  });

  // Update form when task loads or AI output changes
  useEffect(() => {
    if (task?.result) {
      const classification = (task.result.classification || parsedAI.classification || 'others') as TaskAnnotation['classification'];
      form.setValues({
        classification,
        nutrition: task.result.nutrition || parsedAI.nutrition,
        result_return_judgement: (task.result as any)?.result_return_judgement || (isEmptyAIOutput ? 'no_result_return' : 'result_return'),
        feedback_correction: (task.result as any)?.feedback_correction,
      });
    } else if (parsedAI.classification) {
      const validClassifications: TaskAnnotation['classification'][] = ['meal', 'label', 'front_label', 'screenshot', 'others'];
      const classification = validClassifications.includes(parsedAI.classification as any) 
        ? parsedAI.classification as TaskAnnotation['classification']
        : 'others';
      form.setFieldValue('classification', classification);
      form.setFieldValue('result_return_judgement', isEmptyAIOutput ? 'no_result_return' : 'result_return');
    }
  }, [task, parsedAI, isEmptyAIOutput]);

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
    onError: (error: any) => {
      console.error('Save error:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to save task annotation';
      notifications.show({
        title: 'Error',
        message: errorMessage,
        color: 'red',
        icon: <IconX />,
      });
    },
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: (data: TaskAnnotation) => taskService.submitTask(id!, data),
    onSuccess: () => {
      const isResubmission = task?.status === 'completed';
      notifications.show({
        title: isResubmission ? 'Re-submitted' : 'Submitted',
        message: isResubmission ? 'Task annotation updated successfully' : 'Task completed successfully',
        color: 'green',
        icon: <IconCheck />,
      });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      // Navigate to next task (only for new submissions, not re-submissions)
      if (!isResubmission) {
        handleGetNextTask();
      }
    },
    onError: (error: any) => {
      console.error('Submit error:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to submit task';
      notifications.show({
        title: 'Error',
        message: errorMessage,
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
        message: 'Task skipped, loading next...',
        color: 'yellow',
      });
      // Close modal if open
      modals.closeAll();
      // Navigate to next task
      handleGetNextTask();
    },
    onError: (error: any) => {
      console.error('Skip error:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to skip task';
      notifications.show({
        title: 'Error',
        message: errorMessage,
        color: 'red',
        icon: <IconX />,
      });
    },
  });

  // Get next task
  const handleGetNextTask = async () => {
    try {
      const nextTask = await taskService.getNextTask('user123'); // Mock user
      if (nextTask) {
        navigate(`/tasks/${nextTask.id}`);
      } else {
        // No next task available, go back to list and open drawer for current task
        notifications.show({
          title: 'No more tasks',
          message: 'This is the last task. Returning to task list.',
          color: 'blue',
        });
        navigate('/tasks', { 
          state: { 
            openDrawerForTask: id // Pass current task id to open drawer
          } 
        });
      }
    } catch (error) {
      console.error('Error getting next task:', error);
      // On error, go back to list and try to open drawer for current task
      navigate('/tasks', { 
        state: { 
          openDrawerForTask: id 
        } 
      });
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
    let hasErrors = validation.hasErrors;

    // Validation handled by form.validate() - no manual checks needed

    if (hasErrors) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fix the form errors before submitting',
        color: 'red',
      });
      return;
    }

    // If task is already completed, ask for confirmation
    if (task?.status === 'completed') {
      modals.openConfirmModal({
        title: 'Re-submit Completed Task?',
        children: (
          <Stack gap="sm">
            <Text size="sm">
              This task was already completed. Are you sure you want to re-submit with new changes?
            </Text>
            <Text size="xs" c="dimmed">
              This will update the annotation and keep the task as completed.
            </Text>
          </Stack>
        ),
        labels: { confirm: 'Re-submit', cancel: 'Cancel' },
        confirmProps: { color: 'orange' },
        onConfirm: () => {
          // Check nutrition validation
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
        },
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

  const PREDEFINED_SKIP_REASONS = [
    'Math Error Detected',
    'Insufficient Image Quality',
    'Generic/Vague Output',
    'Missing Critical Info',
  ];

  const handleSkip = () => {
    const SkipModalContent = ({ context, id }: any) => {
      const [localReason, setLocalReason] = useState('');
      const [localType, setLocalType] = useState<'predefined' | 'custom'>('predefined');

      const handleConfirm = () => {
        if (localReason) {
          skipMutation.mutate(localReason);
          // Modal will be closed by skipMutation.onSuccess
        }
      };

      return (
        <Stack gap="md">
          <Text size="sm">Select a reason for skipping this task:</Text>
          <Radio.Group
            value={localType}
            onChange={(value) => setLocalType(value as 'predefined' | 'custom')}
          >
            <Stack gap="xs">
              <Radio value="predefined" label="Select from common reasons" />
              <Radio value="custom" label="Enter custom reason" />
            </Stack>
          </Radio.Group>
          
          {localType === 'predefined' ? (
            <Select
              placeholder="Select reason"
              data={PREDEFINED_SKIP_REASONS}
              value={localReason}
              onChange={(value) => setLocalReason(value || '')}
              required
              withinPortal
            />
          ) : (
            <Textarea
              placeholder="Enter custom reason"
              value={localReason}
              onChange={(e) => setLocalReason(e.currentTarget.value)}
              required
              minRows={3}
            />
          )}

          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="default" onClick={() => context.closeModal(id)}>
              Cancel
            </Button>
            <Button 
              color="yellow" 
              onClick={handleConfirm}
              disabled={!localReason}
              loading={skipMutation.isPending}
            >
              Skip Task
            </Button>
          </Group>
        </Stack>
      );
    };

    modals.open({
      modalId: 'skip-task-modal',
      title: 'Skip Task',
      children: <SkipModalContent context={modals} id="skip-task-modal" />,
      size: 'md',
    });
  };

  // Handle category click to filter tasks
  const handleCategoryClick = (category: string) => {
    navigate(`/tasks?category=${encodeURIComponent(category)}`);
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

  // Removed hotkeys for classification numbers since labels no longer show numbers

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
                Hotkeys: ⌘+S (save) • ⌘+Enter (submit) • ⌘+Shift+S (skip)
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
                <Group justify="space-between">
                  <Title order={4}>Image</Title>
                  <Tooltip label="View full-screen">
                    <ActionIcon
                      variant="subtle"
                      onClick={() => setImageModalOpened(true)}
                      disabled={imageError}
                    >
                      <IconZoomIn size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
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
                      style={{ cursor: 'pointer' }}
                      onClick={() => setImageModalOpened(true)}
                    />
                  )}
                  <Divider my="sm" />
                  <Group justify="center">
                    <CopyButton value={task.user_input}>
                      {({ copied, copy }) => (
                        <Button
                          variant="light"
                          fullWidth
                          leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                          onClick={copy}
                        >
                          {copied ? 'URL Copied!' : 'Copy Image URL'}
                        </Button>
                      )}
                    </CopyButton>
                  </Group>
                </ScrollArea>
              </Stack>
            </Card>
          </Grid.Col>

          {/* Image Full-Screen Modal */}
          <Modal
            opened={imageModalOpened}
            onClose={() => setImageModalOpened(false)}
            size="xl"
            title="Full-Screen Image"
            centered
          >
            <Image
              src={task?.user_input}
              alt="Task image full-screen"
              fit="contain"
              radius="md"
            />
          </Modal>

          {/* Middle Panel - AI Output */}
          <Grid.Col span={4}>
            <Card h="100%" withBorder p="md">
              <Stack h="100%">
                <Group justify="space-between">
                  <Title order={4}>AI Analysis</Title>
                  {task?.raw_ai_output && (
                    <CopyButton value={JSON.stringify(task.raw_ai_output, null, 2)}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'Copied!' : 'Copy JSON'}>
                          <ActionIcon
                            variant="light"
                            size="sm"
                            onClick={copy}
                          >
                            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                  )}
                </Group>
                <Divider />
                <ScrollArea style={{ minHeight: '200px', maxHeight: '600px' }} type="auto">
                  <Stack gap="sm">
                    {task?.raw_ai_output ? (
                      <Code block style={{ fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                        {typeof task.raw_ai_output === 'string' 
                          ? task.raw_ai_output 
                          : JSON.stringify(task.raw_ai_output, null, 2)}
                      </Code>
                    ) : (
                      <Text size="sm" c="dimmed">No AI analysis available</Text>
                    )}

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

          {/* Right Panel - Annotation Form & Guide */}
          <Grid.Col span={4}>
            <Stack h="100%" gap="md">
              <Card h="100%" withBorder p="md" style={{ flex: 1, display: 'flex' }}>
                <Stack h="100%" justify="space-between">
                  <Stack>
                    <Title order={4}>Annotation</Title>
                    <Divider />

                    <form>
                      <Stack gap="md">
                        {/* Classification */}
                        <Tooltip 
                          label="Meal: Prepared food | Label: Nutrition facts | Front Label: Marketing text | Screenshot: Digital source | Others: Unclear/invalid"
                          multiline
                          w={300}
                          position="top"
                        >
                          <Select
                            label="Classification"
                            placeholder="Select classification"
                            data={[
                              { value: 'meal', label: 'Meal' },
                              { value: 'label', label: 'Label' },
                              { value: 'front_label', label: 'Front Label' },
                              { value: 'screenshot', label: 'Screenshot' },
                              { value: 'others', label: 'Others' },
                            ]}
                            {...form.getInputProps('classification')}
                            required
                            error={form.errors.classification}
                            allowDeselect={false}
                          />
                        </Tooltip>

                        {/* Result Return Judgement - Auto-detected */}
                        <Stack gap={4}>
                          <Tooltip 
                            label="Auto-detected based on AI output. Empty output → No Result Returned"
                            multiline
                            w={280}
                            position="top"
                          >
                            <Select
                              label="Result Return Judgement"
                              placeholder="Select judgement"
                              data={[
                                { value: 'result_return', label: 'Result Returned' },
                                { value: 'no_result_return', label: 'No Result Returned' },
                              ]}
                              {...form.getInputProps('result_return_judgement')}
                              required
                              error={form.errors.result_return_judgement}
                              allowDeselect={false}
                            />
                          </Tooltip>
                          {isEmptyAIOutput && (
                            <Text size="xs" c="dimmed" fs="italic">
                              <Text component="span" fw={700}>Auto-set:</Text> Empty AI output detected
                            </Text>
                          )}
                        </Stack>

                        {/* Feedback Correction - Multiple Selection */}
                        <Tooltip 
                          label="Evaluate end-user feedback accuracy. Can select multiple issues if feedback exists."
                          multiline
                          w={300}
                          position="top"
                        >
                          <MultiSelect
                            label="Feedback Correction"
                            placeholder="Select all that apply"
                            data={[
                              { value: 'correct_feedback', label: 'Correct Feedback' },
                              { value: 'wrong_food', label: 'Wrong Food' },
                              { value: 'incorrect_nutrition', label: 'Incorrect Nutrition' },
                              { value: 'incorrect_ingredients', label: 'Incorrect Ingredients' },
                              { value: 'wrong_portion_size', label: 'Wrong Portion Size' },
                              { value: 'no_feedback', label: 'No Feedback' },
                            ]}
                            {...form.getInputProps('feedback_correction')}
                            error={form.errors.feedback_correction}
                            clearable
                            searchable
                          />
                        </Tooltip>

                        {/* End-User Feedback - Read Only */}
                        <EndUserFeedback
                          feedback={task.end_user_feedback}
                          onCategoryClick={handleCategoryClick}
                          userFullName={task.user_full_name}
                          scanDate={task.scan_date}
                        />

                        {/* Task Metadata */}
                        <Paper p="sm" withBorder>
                          <Stack gap="xs">
                            <Text size="xs" fw={500}>Task Info:</Text>
                            <Text size="xs">Request ID: {task.request_id}</Text>
                            <Text size="xs">Team: {task.team_id}</Text>
                            <Text size="xs">
                              Type: <Text component="span" fw={700} tt="uppercase">{task.type}</Text>
                            </Text>
                            <Text size="xs">
                              Scanned: {new Date(task.scan_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Text>
                          </Stack>
                        </Paper>
                      </Stack>
                    </form>
                  </Stack>

                  {/* Action Buttons */}
                  <Stack gap="sm">
                    {/* Status Indicator */}
                    {task.status === 'completed' && (
                      <Alert icon={<IconCheck />} color="green" variant="light">
                        <Text size="sm" fw={500}>Task Completed</Text>
                        <Text size="xs" c="dimmed">You can edit and re-submit if needed</Text>
                      </Alert>
                    )}
                    
                    {task.status === 'in_progress' && (
                      <Alert icon={<IconInfoCircle />} color="blue" variant="light">
                        <Text size="sm">Working on this task</Text>
                      </Alert>
                    )}

                    <Group grow>
                      {/* Save Draft - only show if not completed */}
                      {task.status !== 'completed' && (
                        <Tooltip label="Save your work without submitting (⌘+S)">
                          <Button
                            variant="light"
                            leftSection={<IconDeviceFloppy size={20} />}
                            onClick={handleSave}
                            loading={saveMutation.isPending}
                          >
                            Save Draft
                          </Button>
                        </Tooltip>
                      )}

                      {/* Submit/Re-submit button */}
                      <Tooltip label={
                        task.status === 'completed' 
                          ? "Re-submit changes (⌘+Enter)" 
                          : "Complete and move to next task (⌘+Enter)"
                      }>
                        <Button
                          variant="filled"
                          color={task.status === 'completed' ? 'orange' : 'blue'}
                          leftSection={<IconSend size={20} />}
                          onClick={handleSubmit}
                          loading={submitMutation.isPending}
                          disabled={
                            !form.values.classification ||
                            !form.values.result_return_judgement
                          }
                          fullWidth={task.status === 'completed'}
                        >
                          {task.status === 'completed' ? 'Re-submit Changes' : 'Submit & Next'}
                        </Button>
                      </Tooltip>
                    </Group>

                    {/* Skip - only show if not completed */}
                    {task.status !== 'completed' && (
                      <Tooltip label="Skip this task and move to next (⌘+Shift+S)">
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
                    )}
                  </Stack>
                </Stack>
              </Card>


            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}