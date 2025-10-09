import { useState } from 'react';
import {
  Card,
  Stack,
  Group,
  Button,
  Select,
  Textarea,
  Text,
  Badge,
  Alert,
  Divider,
  Paper,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import {
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconMessage,
  IconBulb,
  IconInfoCircle,
  IconPlus,
} from '@tabler/icons-react';
import {
  ReviewAction,
  ReviewReasonCode,
  CreateReviewRequest,
  CreateIssueRequest,
  IssueType,
  REASON_CODE_LABELS,
  ISSUE_TYPE_COLORS,
  REVIEW_ACTION_COLORS,
} from '../types/review.types';

interface ReviewPanelProps {
  taskId: string;
  originalAnnotation: any;
  reviewedAnnotation?: any;
  onSubmit: (review: CreateReviewRequest) => Promise<void>;
  isSubmitting?: boolean;
}

interface IssueFormData {
  field_name: string;
  issue_type: IssueType;
  description: string;
  original_value?: string;
  suggested_value?: string;
}

export function ReviewPanel({
  taskId,
  originalAnnotation,
  reviewedAnnotation,
  onSubmit,
  isSubmitting = false,
}: ReviewPanelProps) {
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [issues, setIssues] = useState<CreateIssueRequest[]>([]);

  const form = useForm({
    initialValues: {
      reason_code: '' as ReviewReasonCode | '',
      reason_details: '',
    },
    validate: {
      reason_code: (value) => {
        if (action === 'reject' && !value) {
          return 'Reason code is required when rejecting';
        }
        return null;
      },
      reason_details: (value) => {
        if (value && value.length > 500) {
          return 'Details too long (max 500 characters)';
        }
        return null;
      },
    },
  });

  const handleAddIssue = () => {
    modals.open({
      title: 'Add Issue/Comment',
      size: 'md',
      children: (
        <IssueForm
          onSubmit={(issue) => {
            setIssues([...issues, issue]);
            modals.closeAll();
          }}
        />
      ),
    });
  };

  const handleRemoveIssue = (index: number) => {
    setIssues(issues.filter((_, i) => i !== index));
  };

  const handleAccept = async () => {
    setAction('accept');
    await handleSubmit('accept');
  };

  const handleReject = async () => {
    const validation = form.validate();
    if (validation.hasErrors) return;
    
    setAction('reject');
    await handleSubmit('reject');
  };

  const handleSubmit = async (selectedAction: ReviewAction) => {
    const reviewRequest: CreateReviewRequest = {
      task_id: taskId,
      action: selectedAction,
      reason_code: form.values.reason_code || undefined,
      reason_details: form.values.reason_details || undefined,
      original_annotation: originalAnnotation,
      reviewed_annotation: reviewedAnnotation || originalAnnotation,
      issues: issues.length > 0 ? issues : undefined,
    };

    try {
      await onSubmit(reviewRequest);
    } catch (error) {
      console.error('Review submission error:', error);
    }
  };

  const getIssueIcon = (type: IssueType) => {
    switch (type) {
      case 'error':
        return <IconX size={14} />;
      case 'warning':
        return <IconAlertTriangle size={14} />;
      case 'suggestion':
        return <IconBulb size={14} />;
      case 'comment':
        return <IconMessage size={14} />;
      default:
        return <IconInfoCircle size={14} />;
    }
  };

  return (
    <Card withBorder p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={500}>Review Decision</Text>
          {action && (
            <Badge color={REVIEW_ACTION_COLORS[action]} variant="light">
              {action.charAt(0).toUpperCase() + action.slice(1).replace('_', ' ')}
            </Badge>
          )}
        </Group>

        <Divider />

        {/* Reason Code Selection (shown when rejecting) */}
        {action === 'reject' && (
          <Alert color="red" variant="light" icon={<IconAlertTriangle />}>
            <Stack gap="sm">
              <Text size="sm" fw={500}>
                Please provide a reason for rejection
              </Text>
              
              <Select
                label="Reason Code"
                placeholder="Select reason"
                data={Object.entries(REASON_CODE_LABELS).map(([value, label]) => ({
                  value,
                  label,
                }))}
                {...form.getInputProps('reason_code')}
                required
                error={form.errors.reason_code}
              />

              <Textarea
                label="Additional Details"
                placeholder="Provide more context (optional)"
                rows={3}
                {...form.getInputProps('reason_details')}
                error={form.errors.reason_details}
              />
            </Stack>
          </Alert>
        )}

        {/* Issues/Comments Section */}
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" fw={500}>
              Issues & Comments ({issues.length})
            </Text>
            <Tooltip label="Add issue or comment">
              <ActionIcon variant="light" onClick={handleAddIssue}>
                <IconPlus size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {issues.length > 0 ? (
            <Stack gap="xs">
              {issues.map((issue, index) => (
                <Paper key={index} p="xs" withBorder>
                  <Group justify="space-between">
                    <Group gap="xs">
                      <Badge
                        size="sm"
                        color={ISSUE_TYPE_COLORS[issue.issue_type]}
                        variant="light"
                        leftSection={getIssueIcon(issue.issue_type)}
                      >
                        {issue.issue_type}
                      </Badge>
                      {issue.field_name && (
                        <Text size="xs" c="dimmed">
                          {issue.field_name}
                        </Text>
                      )}
                    </Group>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      onClick={() => handleRemoveIssue(index)}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </Group>
                  <Text size="xs" mt="xs">
                    {issue.description}
                  </Text>
                  {issue.suggested_value && (
                    <Text size="xs" c="dimmed" mt={4}>
                      Suggestion: {issue.suggested_value}
                    </Text>
                  )}
                </Paper>
              ))}
            </Stack>
          ) : (
            <Text size="xs" c="dimmed">
              No issues or comments added
            </Text>
          )}
        </Stack>

        <Divider />

        {/* Action Buttons */}
        <Group grow>
          <Button
            variant="filled"
            color="green"
            leftSection={<IconCheck size={20} />}
            onClick={handleAccept}
            loading={isSubmitting && action === 'accept'}
            disabled={isSubmitting}
          >
            Accept
          </Button>
          <Button
            variant="filled"
            color="red"
            leftSection={<IconX size={20} />}
            onClick={handleReject}
            loading={isSubmitting && action === 'reject'}
            disabled={isSubmitting}
          >
            Reject
          </Button>
        </Group>

        {/* Warning about rejection */}
        {action === 'reject' && (
          <Alert color="yellow" variant="light" icon={<IconAlertTriangle />}>
            <Text size="xs">
              Rejecting will return the task to the queue for reassignment to another annotator.
            </Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}

// Sub-component for issue form
function IssueForm({ onSubmit }: { onSubmit: (issue: CreateIssueRequest) => void }) {
  const form = useForm<IssueFormData>({
    initialValues: {
      field_name: '',
      issue_type: 'comment' as IssueType,
      description: '',
      original_value: '',
      suggested_value: '',
    },
    validate: {
      description: (value) => {
        if (!value) return 'Description is required';
        if (value.length > 500) return 'Description too long';
        return null;
      },
    },
  });

  const handleSubmit = () => {
    const validation = form.validate();
    if (validation.hasErrors) return;

    onSubmit({
      field_name: form.values.field_name || undefined,
      issue_type: form.values.issue_type,
      description: form.values.description,
      original_value: form.values.original_value || undefined,
      suggested_value: form.values.suggested_value || undefined,
    });
  };

  return (
    <Stack gap="sm">
      <Select
        label="Issue Type"
        data={[
          { value: 'error', label: 'Error' },
          { value: 'warning', label: 'Warning' },
          { value: 'suggestion', label: 'Suggestion' },
          { value: 'comment', label: 'Comment' },
        ]}
        {...form.getInputProps('issue_type')}
      />

      <Select
        label="Field"
        placeholder="Select field (optional)"
        data={[
          { value: '', label: 'General' },
          { value: 'classification', label: 'Classification' },
          { value: 'tags', label: 'Tags' },
          { value: 'nutrition', label: 'Nutrition' },
        ]}
        {...form.getInputProps('field_name')}
        clearable
      />

      <Textarea
        label="Description"
        placeholder="Describe the issue"
        rows={3}
        {...form.getInputProps('description')}
        required
      />

      <Textarea
        label="Original Value"
        placeholder="Current value (optional)"
        rows={2}
        {...form.getInputProps('original_value')}
      />

      <Textarea
        label="Suggested Value"
        placeholder="Suggested correction (optional)"
        rows={2}
        {...form.getInputProps('suggested_value')}
      />

      <Button onClick={handleSubmit}>Add Issue</Button>
    </Stack>
  );
}