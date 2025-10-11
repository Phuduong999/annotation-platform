import { useState } from 'react';
import {
  Drawer,
  Grid,
  Stack,
  Group,
  Title,
  Text,
  Button,
  Image,
  Badge,
  Divider,
  SegmentedControl,
  Select,
  Textarea,
  Card,
  Code,
  ScrollArea,
  Alert,
  ActionIcon,
  Modal,
  Kbd,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useHotkeys, useDisclosure } from '@mantine/hooks';
import {
  IconCheck,
  IconX,
  IconZoomIn,
  IconAlertTriangle,
  IconInfoCircle,
} from '@tabler/icons-react';
import { taskService } from '../services/task.service';
import { Task, TaskAnnotation } from '../types/task.types';

interface AnnotationDrawerProps {
  opened: boolean;
  onClose: () => void;
  task: Task | null;
  onSuccess?: () => void;
}

export function AnnotationDrawer({ opened, onClose, task, onSuccess }: AnnotationDrawerProps) {
  const queryClient = useQueryClient();
  const [imageModalOpened, { open: openImageModal, close: closeImageModal }] = useDisclosure(false);
  const [imageError, setImageError] = useState(false);

  // Form setup
  const form = useForm<TaskAnnotation>({
    initialValues: {
      scan_type_judgement: '',
      result_return_judgement: '',
      corrected_type: '',
      notes: '',
    },
  });

  // Reset form when task changes
  useState(() => {
    if (task) {
      form.reset();
    }
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: (data: TaskAnnotation) => {
      if (!task) throw new Error('No task selected');
      return taskService.submitAnnotation(task.id, data);
    },
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: 'Annotation submitted successfully',
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      form.reset();
      onSuccess?.();
      onClose();
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

  // Keyboard shortcuts (only when drawer is open)
  useHotkeys(
    [
      ['1', () => opened && form.setFieldValue('scan_type_judgement', 'correct_type')],
      ['2', () => opened && form.setFieldValue('scan_type_judgement', 'wrong_type')],
      ['3', () => opened && form.setFieldValue('result_return_judgement', 'result_return')],
      ['4', () => opened && form.setFieldValue('result_return_judgement', 'no_result_return')],
      ['mod+Enter', (e) => {
        if (opened) {
          e.preventDefault();
          handleSubmit();
        }
      }],
    ],
    []
  );

  if (!task) return null;

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        title={
          <Group>
            <Title order={4}>Quick Annotation</Title>
            <Badge color="blue">{task.type}</Badge>
            <Badge color="gray">{task.status}</Badge>
          </Group>
        }
        position="right"
        size="90%"
        padding={0}
      >
        <Grid m={0} gutter={0} h="calc(100vh - 60px)">
          {/* Left: Image + User Info (60%) */}
          <Grid.Col span={7} style={{ borderRight: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
            <ScrollArea h="100%">
              <Stack p="md" gap="md">
                {/* Image */}
                <Card withBorder p="md">
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>Food Image</Text>
                      <ActionIcon variant="light" onClick={openImageModal} disabled={imageError}>
                        <IconZoomIn size={18} />
                      </ActionIcon>
                    </Group>
                    <Divider />
                    {imageError ? (
                      <Alert icon={<IconAlertTriangle />} color="red">
                        Failed to load image
                      </Alert>
                    ) : (
                      <Image
                        src={task.user_input}
                        alt="Task image"
                        fit="contain"
                        h={400}
                        radius="md"
                        style={{ cursor: 'zoom-in' }}
                        onError={() => setImageError(true)}
                        onClick={openImageModal}
                      />
                    )}
                  </Stack>
                </Card>

                {/* User Information */}
                {(task.user_email || task.user_full_name) && (
                  <Card withBorder p="md">
                    <Stack gap="xs">
                      <Text size="sm" fw={500}>User Information</Text>
                      <Divider />
                      {task.user_full_name && (
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">Name</Text>
                          <Text size="sm">{task.user_full_name}</Text>
                        </Group>
                      )}
                      {task.user_email && (
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">Email</Text>
                          <Text size="sm">{task.user_email}</Text>
                        </Group>
                      )}
                      {task.is_logged !== null && (
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">Is Logged</Text>
                          <Badge color={task.is_logged ? 'green' : 'gray'} size="sm">
                            {task.is_logged ? 'Yes' : 'No'}
                          </Badge>
                        </Group>
                      )}
                    </Stack>
                  </Card>
                )}

                {/* Feedback from User */}
                {task.end_user_feedback && (
                  <Card withBorder p="md">
                    <Stack gap="xs">
                      <Text size="sm" fw={500}>User Feedback</Text>
                      <Divider />
                      {task.end_user_feedback.reaction && (
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">Reaction</Text>
                          <Badge color={task.end_user_feedback.reaction === 'like' ? 'green' : 'red'}>
                            {task.end_user_feedback.reaction}
                          </Badge>
                        </Group>
                      )}
                      {task.end_user_feedback.category && (
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">Category</Text>
                          <Badge>{task.end_user_feedback.category}</Badge>
                        </Group>
                      )}
                      {task.end_user_feedback.note && (
                        <>
                          <Text size="sm" c="dimmed">Note</Text>
                          <Text size="sm">{task.end_user_feedback.note}</Text>
                        </>
                      )}
                    </Stack>
                  </Card>
                )}

                {/* Edit Category / User Log */}
                {(task.edit_category || task.user_log) && (
                  <Card withBorder p="md">
                    <Stack gap="xs">
                      <Text size="sm" fw={500}>User Data</Text>
                      <Divider />
                      {task.edit_category && (
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">Edit Category</Text>
                          <Badge>{task.edit_category}</Badge>
                        </Group>
                      )}
                      {task.user_log && (
                        <>
                          <Text size="sm" c="dimmed">User Log</Text>
                          <Code block style={{ fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                            {task.user_log}
                          </Code>
                        </>
                      )}
                    </Stack>
                  </Card>
                )}

                {/* Raw AI Output */}
                {task.raw_ai_output && (
                  <Card withBorder p="md">
                    <Stack gap="xs">
                      <Text size="sm" fw={500}>AI Output (Raw)</Text>
                      <Divider />
                      <Code block style={{ fontSize: '10px', maxHeight: 200, overflow: 'auto' }}>
                        {JSON.stringify(task.raw_ai_output, null, 2)}
                      </Code>
                    </Stack>
                  </Card>
                )}
              </Stack>
            </ScrollArea>
          </Grid.Col>

          {/* Right: Annotation Form (40%) */}
          <Grid.Col span={5} style={{ backgroundColor: '#fff' }}>
            <ScrollArea h="100%">
              <Stack p="md" gap="md">
                <div>
                  <Title order={4}>Your Annotation</Title>
                  <Text size="sm" c="dimmed">
                    Label this task quickly and accurately
                  </Text>
                </div>

                {/* Quick Actions */}
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
                    {/* Scan Type Judgement */}
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

                    {/* Result Return Judgement */}
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

                    {/* Corrected Type */}
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

                    {/* Notes */}
                    <Textarea
                      label="Notes (optional)"
                      placeholder="Add any additional comments..."
                      value={form.values.notes}
                      onChange={(e) => form.setFieldValue('notes', e.target.value)}
                      minRows={3}
                      maxRows={6}
                    />

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      size="lg"
                      fullWidth
                      loading={submitMutation.isPending}
                      rightSection={<Text size="sm">Ctrl+Enter</Text>}
                    >
                      Submit Annotation
                    </Button>
                  </Stack>
                </form>

                {/* Annotation Guide */}
                <Card withBorder p="sm" bg="blue.0">
                  <Group gap="xs" mb="xs">
                    <IconInfoCircle size={16} />
                    <Text size="sm" fw={500}>Quick Guide</Text>
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
              </Stack>
            </ScrollArea>
          </Grid.Col>
        </Grid>
      </Drawer>

      {/* Image Full-Screen Modal */}
      <Modal
        opened={imageModalOpened}
        onClose={closeImageModal}
        size="100%"
        fullScreen
        title={`Task: ${task.request_id}`}
      >
        <Image
          src={task.user_input}
          alt="Task image full-screen"
          fit="contain"
          h="90vh"
        />
      </Modal>
    </>
  );
}
