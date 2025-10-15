import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Card,
  Code,
  ScrollArea,
  Alert,
  Modal,
  Tooltip,
  CopyButton,
  Box,
  Paper,
  ActionIcon,
} from '@mantine/core';
import { useHotkeys, useDisclosure } from '@mantine/hooks';
import {
  IconExternalLink,
  IconAlertTriangle,
  IconInfoCircle,
  IconArrowRight,
  IconCopy,
  IconCheck,
  IconChevronRight,
} from '@tabler/icons-react';
import { Task } from '../types/task.types';

interface AnnotationDrawerProps {
  opened: boolean;
  onClose: () => void;
  task: Task | null;
  tasks?: Task[]; // For Load Next functionality
  onLoadNext?: () => void;
}


export function AnnotationDrawer({ opened, onClose, task, tasks, onLoadNext }: AnnotationDrawerProps) {
  const navigate = useNavigate();
  const [jsonModalOpened, { open: openJsonModal, close: closeJsonModal }] = useDisclosure(false);
  const [imageError, setImageError] = useState(false);

  const handleTakeAction = () => {
    if (task) {
      navigate(`/tasks/${task.id}`);
      onClose();
    }
  };

  const handleLoadNext = () => {
    if (onLoadNext) {
      onLoadNext();
    }
  };

  // Keyboard shortcuts
  useHotkeys(
    [
      ['n', () => opened && handleLoadNext()],
      ['Enter', () => opened && handleTakeAction()],
      ['Escape', () => opened && onClose()],
    ],
    []
  );

  if (!task) return null;

  // Parse AI output for summary
  const aiSummary = task.raw_ai_output ? (
    typeof task.raw_ai_output === 'object' ? task.raw_ai_output : 
    (() => { try { return JSON.parse(task.raw_ai_output); } catch { return null; } })()
  ) : null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'yellow';
      case 'in_progress': return 'blue';
      case 'completed': return 'green';
      case 'skipped': return 'gray';
      default: return 'gray';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'meal': return 'grape';
      case 'label': return 'cyan';
      case 'front_label': return 'teal';
      case 'screenshot': return 'orange';
      default: return 'gray';
    }
  };

  return (
    <>
      <Drawer
        offset={8} 
        radius="md"
        opened={opened}
        onClose={onClose}
        title={null}
        position="right"
        size="90%"
        padding={0}
      >
        <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Paper p="md" withBorder style={{ borderLeft: 0, borderRight: 0, borderTop: 0, flexShrink: 0 }}>
            <Stack gap="xs">
              <Group justify="space-between">
                <Group gap="xs">
                  <Title order={4}>Quick Preview</Title>
                  <Badge color={getTypeColor(task.type)}>{task.type}</Badge>
                  <Badge color={getStatusColor(task.status)}>{task.status}</Badge>
                </Group>
                {/* <CopyButton value={task.request_id}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied!' : 'Copy Request ID'}>
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                        onClick={copy}
                      >
                        {task.request_id.slice(0, 8)}...
                      </Button>
                    </Tooltip>
                  )}
                </CopyButton> */}
              </Group>
              <Group gap="md">
                <Text size="sm" c="dimmed">
                  <b>Assigned:</b> {task.assigned_to || 'Unassigned'}
                </Text>
                <Text size="sm" c="dimmed">
                  <b>Created:</b> {new Date(task.created_at).toLocaleString()}
                </Text>
                {task.assigned_at && (
                  <Text size="sm" c="dimmed">
                    <b>Assigned at:</b> {new Date(task.assigned_at).toLocaleString()}
                  </Text>
                )}
              </Group>
            </Stack>
          </Paper>

          {/* Content Grid */}
          <Grid m={0} gutter={0} style={{ flex: 1, overflow: 'hidden' }}>
            {/* Left: Image + Link Health */}
            <Grid.Col span={4} style={{ borderRight: '1px solid #dee2e6', height: '100%' }}>
              <ScrollArea h="100%" type="auto">
                <Stack p="md" gap="md">
                  {/* Image Preview */}
                  <Card withBorder>
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text size="sm" fw={500}>Image Preview</Text>
                        <Tooltip label="Open in new tab">
                          <ActionIcon
                            variant="light"
                            component="a"
                            href={task.user_input}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <IconExternalLink size={18} />
                          </ActionIcon>
                        </Tooltip>
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
                          h={300}
                          radius="md"
                          onError={() => setImageError(true)}
                        />
                      )}
                      <CopyButton value={task.user_input}>
                        {({ copied, copy }) => (
                          <Button
                            size="xs"
                            variant="light"
                            fullWidth
                            leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                            onClick={copy}
                          >
                            {copied ? 'Copied!' : 'Copy Image URL'}
                          </Button>
                        )}
                      </CopyButton>
                    </Stack>
                  </Card>

                  {/* Link Health Info */}
                  <Card withBorder>
                    <Stack gap="xs">
                      <Text size="sm" fw={500}>Link Health</Text>
                      <Divider />
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">Status</Text>
                        <Badge size="sm" color={imageError ? 'red' : 'green'}>
                          {imageError ? 'Error' : 'OK'}
                        </Badge>
                      </Group>
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">MIME Type</Text>
                        <Text size="xs">image/*</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="xs" c="dimmed">AI Confidence</Text>
                        <Text size="xs">{(task.ai_confidence * 100).toFixed(1)}%</Text>
                      </Group>
                    </Stack>
                  </Card>
                </Stack>
              </ScrollArea>
            </Grid.Col>

            {/* Middle: AI Summary + Raw JSON */}
            <Grid.Col span={4} style={{ borderRight: '1px solid #dee2e6', height: '100%' }}>
              <ScrollArea h="100%" type="auto">
                <Stack p="md" gap="md">
                  {/* AI Summary */}
                  <Card withBorder>
                    <Stack gap="xs">
                      <Text size="sm" fw={500}>AI Analysis Summary</Text>
                      <Divider />
                      {aiSummary ? (
                        <>
                          {aiSummary.name_food && (
                            <Box>
                              <Text size="xs" c="dimmed">Food Name</Text>
                              <Text size="sm" fw={500}>{aiSummary.name_food}</Text>
                            </Box>
                          )}
                          {aiSummary.ingredients && (
                            <Box>
                              <Text size="xs" c="dimmed">Ingredients Count</Text>
                              <Text size="sm">
                                {Array.isArray(aiSummary.ingredients) 
                                  ? aiSummary.ingredients.length 
                                  : Object.keys(aiSummary.ingredients || {}).length} items
                              </Text>
                            </Box>
                          )}
                          {aiSummary.calories && (
                            <Box>
                              <Text size="xs" c="dimmed">Calories</Text>
                              <Text size="sm" fw={500}>{aiSummary.calories} kcal</Text>
                            </Box>
                          )}
                          {aiSummary.total_fat && (
                            <Group gap="xl">
                              <Box>
                                <Text size="xs" c="dimmed">Fat</Text>
                                <Text size="sm">{aiSummary.total_fat}g</Text>
                              </Box>
                              <Box>
                                <Text size="xs" c="dimmed">Protein</Text>
                                <Text size="sm">{aiSummary.protein || 0}g</Text>
                              </Box>
                              <Box>
                                <Text size="xs" c="dimmed">Carbs</Text>
                                <Text size="sm">{aiSummary.carbohydrate || 0}g</Text>
                              </Box>
                            </Group>
                          )}
                        </>
                      ) : (
                        <Text size="sm" c="dimmed">No AI analysis available</Text>
                      )}
                      <Button
                        size="xs"
                        variant="light"
                        fullWidth
                        onClick={openJsonModal}
                      >
                        View Raw JSON
                      </Button>
                    </Stack>
                  </Card>
                </Stack>
              </ScrollArea>
            </Grid.Col>

            {/* Right: Read-only Info Blocks */}
            <Grid.Col span={4} style={{ height: '100%' }}>
              <ScrollArea h="100%" type="auto">
                <Stack p="md" gap="md">
                  {/* User Type (Immutable from Import) */}
                  {(task.user_email || task.user_full_name || task.is_logged !== null) && (
                    <Card withBorder>
                      <Stack gap="xs">
                        <Group gap="xs">
                          <IconInfoCircle size={16} />
                          <Text size="sm" fw={500}>User Info (From Import)</Text>
                        </Group>
                        <Divider />
                        {task.user_full_name && (
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed">Name</Text>
                            <Text size="sm">{task.user_full_name}</Text>
                          </Group>
                        )}
                        {task.user_email && (
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed">Email</Text>
                            <Text size="sm">{task.user_email}</Text>
                          </Group>
                        )}
                        {task.is_logged !== null && task.is_logged !== undefined && (
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed">Is Logged</Text>
                            <Badge size="sm" color={task.is_logged ? 'green' : 'gray'}>
                              {task.is_logged ? 'Yes' : 'No'}
                            </Badge>
                          </Group>
                        )}
                        {task.edit_category && (
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed">Edit Category</Text>
                            <Badge size="sm">{task.edit_category}</Badge>
                          </Group>
                        )}
                      </Stack>
                    </Card>
                  )}

                  {/* Current Annotation (if completed) */}
                  {task.status === 'completed' && task.annotation && (
                    <Card withBorder bg="green.0">
                      <Stack gap="xs">
                        <Group gap="xs">
                          <IconCheck size={16} />
                          <Text size="sm" fw={500}>Annotation Results</Text>
                        </Group>
                        <Divider />
                        
                        {/* Scan Type */}
                        {task.annotation.scan_type && (
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed">Classification</Text>
                            <Badge size="sm" color={getTypeColor(task.annotation.scan_type)}>
                              {task.annotation.scan_type}
                            </Badge>
                          </Group>
                        )}

                        {/* Result Return */}
                        {task.annotation.result_return && (
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed">Result Return</Text>
                            <Badge 
                              size="sm" 
                              color={task.annotation.result_return === 'correct_result' ? 'green' : 'red'}
                            >
                              {task.annotation.result_return === 'correct_result' ? 'Correct' : task.annotation.result_return === 'wrong_result' ? 'Wrong' : 'No Result'}
                            </Badge>
                          </Group>
                        )}

                        {/* Feedback Correction */}
                        {task.annotation.feedback_correction && task.annotation.feedback_correction.length > 0 && (
                          <Box>
                            <Text size="xs" c="dimmed" mb={4}>Feedback Correction</Text>
                            <Group gap={4}>
                              {task.annotation.feedback_correction.map((correction: string, idx: number) => (
                                <Badge key={idx} size="xs" variant="light">
                                  {correction.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                            </Group>
                          </Box>
                        )}

                        {/* Note */}
                        {task.annotation.note && (
                          <Box>
                            <Text size="xs" c="dimmed">Note</Text>
                            <Text size="xs">{task.annotation.note}</Text>
                          </Box>
                        )}

                        {/* Annotated by */}
                        {task.annotation.created_by && (
                          <Box>
                            <Text size="xs" c="dimmed">
                              Annotated by {task.annotation.created_by} on{' '}
                              {new Date(task.annotation.created_at).toLocaleString()}
                            </Text>
                          </Box>
                        )}

                        <Alert icon={<IconInfoCircle />} color="blue" variant="light" mt="xs">
                          Click "Take Action" to view details or modify.
                        </Alert>
                      </Stack>
                    </Card>
                  )}

                  {/* End-user Feedback (Read-only) */}
                  {task.end_user_feedback && (
                    task.end_user_feedback.reaction || 
                    task.end_user_feedback.category || 
                    task.end_user_feedback.note
                  ) && (
                    <Card withBorder>
                      <Stack gap="xs">
                        <Text size="sm" fw={500}>End-User Feedback</Text>
                        <Divider />
                        {task.end_user_feedback.reaction && (
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed">Reaction</Text>
                            <Badge
                              size="sm"
                              color={task.end_user_feedback.reaction === 'like' ? 'green' : 'red'}
                            >
                              {task.end_user_feedback.reaction}
                            </Badge>
                          </Group>
                        )}
                        {task.end_user_feedback.category && (
                          <Group justify="space-between">
                            <Text size="xs" c="dimmed">Category</Text>
                            <Badge size="sm">{task.end_user_feedback.category}</Badge>
                          </Group>
                        )}
                        {task.end_user_feedback.note && (
                          <>
                            <Text size="xs" c="dimmed">Note</Text>
                            <Text size="sm">{task.end_user_feedback.note}</Text>
                          </>
                        )}
                      </Stack>
                    </Card>
                  )}

                  {/* Annotation Guide */}
                  {/* <Card withBorder bg="blue.0">
                    <Stack gap="xs">
                      <Group gap="xs">
                        <IconInfoCircle size={16} />
                        <Text size="sm" fw={500}>Quick Guide</Text>
                      </Group>
                      <Divider />
                      {ANNOTATION_GUIDE.map((guide) => (
                        <Box key={guide.type}>
                          <Text size="xs" fw={600} c={guide.type === task.type ? 'blue' : 'dark'}>
                            {guide.type}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {guide.description}
                          </Text>
                        </Box>
                      ))}
                    </Stack>
                  </Card> */}
                </Stack>
              </ScrollArea>
            </Grid.Col>
          </Grid>

          {/* Actions Footer */}
          <Paper p="md" withBorder style={{ borderLeft: 0, borderRight: 0, borderBottom: 0, flexShrink: 0 }}>
            <Group justify="space-between">
              <Group gap="xs">
                <Text size="xs" c="dimmed">
                  Press <Badge size="sm" variant="light">Enter</Badge> to take action,{' '}
                  <Badge size="sm" variant="light">N</Badge> for next
                </Text>
              </Group>
              <Group gap="xs">
                {onLoadNext && (
                  <Button
                    variant="light"
                    leftSection={<IconChevronRight size={16} />}
                    onClick={handleLoadNext}
                  >
                    Load Next
                  </Button>
                )}
                <Button
                  variant="filled"
                  rightSection={<IconArrowRight size={16} />}
                  onClick={handleTakeAction}
                >
                  Take Action
                </Button>
              </Group>
            </Group>
          </Paper>
        </Box>
      </Drawer>

      {/* Raw JSON Modal (Read-only) */}
      <Modal
        opened={jsonModalOpened}
        onClose={closeJsonModal}
        title="Raw AI Output (Read-only)"
        size="xl"
      >
        <ScrollArea h="70vh">
          <Code block style={{ fontSize: '11px' }}>
            {JSON.stringify(task.raw_ai_output, null, 2)}
          </Code>
        </ScrollArea>
      </Modal>
    </>
  );
}
