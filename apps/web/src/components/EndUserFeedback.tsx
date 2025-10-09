import { Card, Stack, Group, Badge, Text, Paper, Divider, Tooltip, Anchor } from '@mantine/core';
import { IconThumbUp, IconThumbDown, IconMinus, IconExternalLink, IconUser, IconCalendar, IconCategory } from '@tabler/icons-react';
import { EndUserFeedback as EndUserFeedbackType } from '../types/task.types';

interface EndUserFeedbackProps {
  feedback: EndUserFeedbackType | null | undefined;
  onCategoryClick?: (category: string) => void;
}

export function EndUserFeedback({ feedback, onCategoryClick }: EndUserFeedbackProps) {
  if (!feedback) {
    return (
      <Card withBorder p="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={500} size="sm">End-User Feedback</Text>
            <Badge color="gray" variant="light" size="sm">
              No feedback
            </Badge>
          </Group>
          <Text size="xs" c="dimmed">
            No end-user feedback has been submitted for this request.
          </Text>
        </Stack>
      </Card>
    );
  }

  const getReactionIcon = () => {
    switch (feedback.reaction) {
      case 'like':
        return <IconThumbUp size={16} />;
      case 'dislike':
        return <IconThumbDown size={16} />;
      case 'neutral':
        return <IconMinus size={16} />;
      default:
        return null;
    }
  };

  const getReactionColor = () => {
    switch (feedback.reaction) {
      case 'like':
        return 'green';
      case 'dislike':
        return 'red';
      case 'neutral':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const getReactionLabel = () => {
    switch (feedback.reaction) {
      case 'like':
        return 'Positive';
      case 'dislike':
        return 'Negative';
      case 'neutral':
        return 'Neutral';
      default:
        return 'Unknown';
    }
  };

  return (
    <Card withBorder p="md">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <Text fw={500} size="sm">End-User Feedback</Text>
            <Badge 
              color={getReactionColor()} 
              leftSection={getReactionIcon()}
              variant="light"
              size="md"
            >
              {getReactionLabel()}
            </Badge>
          </Group>
          {feedback.user_event_id && (
            <Tooltip label="Event ID from end-user system">
              <Text size="xs" c="dimmed">
                #{feedback.user_event_id}
              </Text>
            </Tooltip>
          )}
        </Group>

        {/* Category */}
        {feedback.category && (
          <Paper p="xs" withBorder>
            <Group gap="xs">
              <IconCategory size={14} />
              <Text size="xs" fw={500}>Category:</Text>
              {onCategoryClick ? (
                <Group gap={4}>
                  <Anchor
                    size="xs"
                    onClick={() => onCategoryClick(feedback.category!)}
                    style={{ cursor: 'pointer' }}
                  >
                    {feedback.category}
                  </Anchor>
                  <Tooltip label="Filter tasks by this category">
                    <IconExternalLink size={12} />
                  </Tooltip>
                </Group>
              ) : (
                <Text size="xs">{feedback.category}</Text>
              )}
            </Group>
          </Paper>
        )}

        {/* Note */}
        {feedback.note && (
          <Paper p="sm" withBorder bg="gray.0">
            <Stack gap="xs">
              <Text size="xs" fw={500}>User Note:</Text>
              <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
                {feedback.note}
              </Text>
            </Stack>
          </Paper>
        )}

        {/* Metadata */}
        <Divider />
        <Group gap="lg">
          <Group gap={4}>
            <IconUser size={12} />
            <Text size="xs" c="dimmed">
              Source: {feedback.source}
            </Text>
          </Group>
          <Group gap={4}>
            <IconCalendar size={12} />
            <Text size="xs" c="dimmed">
              {new Date(feedback.created_at).toLocaleString()}
            </Text>
          </Group>
        </Group>
      </Stack>
    </Card>
  );
}