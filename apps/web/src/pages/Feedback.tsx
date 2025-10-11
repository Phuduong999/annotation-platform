import { Container, Title, Text, Stack, Card, Group, Badge, Table, ActionIcon, Select, TextInput, Textarea, Modal, Button, Tabs, Divider, Paper } from '@mantine/core';
import { IconMessageCircle, IconThumbUp, IconThumbDown, IconMinus, IconPlus, IconRefresh, IconFilter, IconEye, IconCalendar, IconUser } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import { feedbackService, FeedbackEvent, FeedbackEventResponse, FeedbackConflictError } from '../services/feedback.service';
import { DatePickerInput } from '@mantine/dates';

export function Feedback() {
  const [feedbackEvents, setFeedbackEvents] = useState<FeedbackEventResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    reaction: '',
    category: '',
    source: '',
    from_date: '',
    to_date: ''
  });
  
  // Submit feedback form state
  const [feedbackForm, setFeedbackForm] = useState<FeedbackEvent>({
    request_id: '',
    user_event_id: '',
    reaction: 'neutral',
    category: '',
    note: '',
    source: 'manual_submission'
  });

  const loadFeedbackEvents = async () => {
    try {
      setLoading(true);
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== '')
      );
      
      const response = await feedbackService.getFeedbackEvents({
        ...cleanFilters,
        limit: 100
      });
      setFeedbackEvents(response.events);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load feedback events',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedbackEvents();
  }, []);

  const handleSubmitFeedback = async () => {
    try {
      // Use idempotency to prevent accidental duplicates
      const response = await feedbackService.submitFeedbackWithIdempotency(feedbackForm);
      
      const message = response.message ? 
        `Feedback submitted successfully. ${response.message}` : 
        'Feedback submitted successfully';
      
      notifications.show({
        title: 'Success',
        message,
        color: 'green',
      });
      
      setSubmitModalOpen(false);
      setFeedbackForm({
        request_id: '',
        user_event_id: '',
        reaction: 'neutral',
        category: '',
        note: '',
        source: 'manual_submission'
      });
      loadFeedbackEvents();
    } catch (error) {
      if (error instanceof FeedbackConflictError) {
        notifications.show({
          title: 'Duplicate Feedback',
          message: error.details || error.message,
          color: 'orange',
        });
        
        // Still close the modal and refresh data since feedback exists
        setSubmitModalOpen(false);
        setFeedbackForm({
          request_id: '',
          user_event_id: '',
          reaction: 'neutral',
          category: '',
          note: '',
          source: 'manual_submission'
        });
        loadFeedbackEvents();
      } else {
        notifications.show({
          title: 'Error',
          message: 'Failed to submit feedback',
          color: 'red',
        });
      }
    }
  };

  const handleApplyFilters = () => {
    loadFeedbackEvents();
  };

  const handleClearFilters = () => {
    setFilters({
      reaction: '',
      category: '',
      source: '',
      from_date: '',
      to_date: ''
    });
    setTimeout(() => loadFeedbackEvents(), 100);
  };

  const getReactionIcon = (reaction: string) => {
    switch (reaction) {
      case 'like':
        return <IconThumbUp size={16} color="green" />;
      case 'dislike':
        return <IconThumbDown size={16} color="red" />;
      case 'neutral':
        return <IconMinus size={16} color="gray" />;
      default:
        return null;
    }
  };

  const getReactionBadge = (reaction: string) => {
    const colors = {
      like: 'green',
      dislike: 'red',
      neutral: 'gray'
    };
    const labels = {
      like: 'Positive',
      dislike: 'Negative',
      neutral: 'Neutral'
    };
    return (
      <Badge 
        color={colors[reaction as keyof typeof colors] || 'gray'} 
        leftSection={getReactionIcon(reaction)}
        variant="light"
      >
        {labels[reaction as keyof typeof labels] || 'Unknown'}
      </Badge>
    );
  };

  // Calculate stats
  const stats = {
    total: feedbackEvents.length,
    positive: feedbackEvents.filter(f => f.reaction === 'like').length,
    negative: feedbackEvents.filter(f => f.reaction === 'dislike').length,
    neutral: feedbackEvents.filter(f => f.reaction === 'neutral').length
  };

  const positiveRate = stats.total > 0 ? (stats.positive / stats.total * 100).toFixed(1) : '0';
  const negativeRate = stats.total > 0 ? (stats.negative / stats.total * 100).toFixed(1) : '0';

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <div>
          <Title order={1}>Feedback Dashboard</Title>
          <Text size="sm" c="dimmed" mt="xs">
            Track and analyze end-user feedback and sentiment on task results
          </Text>
        </div>

        {/* Summary Cards */}
        <Group grow>
          <Paper withBorder p="md">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase">Total Events</Text>
                <Text size="xl" fw={700}>{stats.total}</Text>
              </div>
              <IconMessageCircle size={24} color="gray" />
            </Group>
          </Paper>
          
          <Paper withBorder p="md">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase">Positive Rate</Text>
                <Text size="xl" fw={700} c="green">{positiveRate}%</Text>
              </div>
              <IconThumbUp size={24} color="green" />
            </Group>
          </Paper>
          
          <Paper withBorder p="md">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase">Negative Rate</Text>
                <Text size="xl" fw={700} c="red">{negativeRate}%</Text>
              </div>
              <IconThumbDown size={24} color="red" />
            </Group>
          </Paper>
        </Group>

        {/* Feedback Events Table */}
        <Card withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <div>
                <Text size="lg" fw={500}>Feedback Events</Text>
                <Text size="sm" c="dimmed">All user feedback submissions</Text>
              </div>
              <Group>
                <Button leftSection={<IconRefresh size={14} />} variant="light" onClick={loadFeedbackEvents} loading={loading}>
                  Refresh
                </Button>
                <Button leftSection={<IconPlus size={14} />} onClick={() => setSubmitModalOpen(true)}>
                  Submit Feedback
                </Button>
              </Group>
            </Group>
            
            {/* Filters */}
            <Paper withBorder p="sm">
              <Group align="end">
                <Select
                  label="Reaction"
                  placeholder="All reactions"
                  data={[
                    { value: 'like', label: 'Positive' },
                    { value: 'dislike', label: 'Negative' },
                    { value: 'neutral', label: 'Neutral' }
                  ]}
                  value={filters.reaction}
                  onChange={(val) => setFilters(prev => ({ ...prev, reaction: val || '' }))}
                  clearable
                  style={{ minWidth: 120 }}
                />
                
                <TextInput
                  label="Category"
                  placeholder="Filter by category"
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                  style={{ minWidth: 150 }}
                />
                
                <TextInput
                  label="Source"
                  placeholder="Filter by source"
                  value={filters.source}
                  onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value }))}
                  style={{ minWidth: 150 }}
                />
                
                <Button leftSection={<IconFilter size={14} />} onClick={handleApplyFilters}>
                  Apply
                </Button>
                
                <Button variant="light" onClick={handleClearFilters}>
                  Clear
                </Button>
              </Group>
            </Paper>
            
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Request ID</Table.Th>
                  <Table.Th>Reaction</Table.Th>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>Source</Table.Th>
                  <Table.Th>Note</Table.Th>
                  <Table.Th>Created</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {feedbackEvents.map((event) => (
                  <Table.Tr key={event.id}>
                    <Table.Td>
                      <Group gap={4}>
                        <Text size="sm" family="monospace">{event.request_id}</Text>
                        {event.user_event_id && (
                          <Text size="xs" c="dimmed">#{event.user_event_id}</Text>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>{getReactionBadge(event.reaction)}</Table.Td>
                    <Table.Td>
                      {event.category ? (
                        <Badge variant="outline" size="sm">{event.category}</Badge>
                      ) : (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{event.source}</Text>
                    </Table.Td>
                    <Table.Td>
                      {event.note ? (
                        <Text size="sm" truncate style={{ maxWidth: 200 }}>
                          {event.note}
                        </Text>
                      ) : (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{new Date(event.created_at).toLocaleString()}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            
            {feedbackEvents.length === 0 && (
              <Text ta="center" c="dimmed" py="xl">
                No feedback events found. Try adjusting your filters or submit some feedback.
              </Text>
            )}
          </Stack>
        </Card>
      </Stack>

      {/* Submit Feedback Modal */}
      <Modal
        opened={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
        title="Submit Feedback"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Request ID"
            placeholder="Enter the request ID"
            value={feedbackForm.request_id}
            onChange={(e) => setFeedbackForm(prev => ({ ...prev, request_id: e.target.value }))}
            required
          />
          
          <TextInput
            label="User Event ID (Optional)"
            placeholder="External event identifier"
            value={feedbackForm.user_event_id}
            onChange={(e) => setFeedbackForm(prev => ({ ...prev, user_event_id: e.target.value }))}
          />
          
          <Select
            label="Reaction"
            data={[
              { value: 'like', label: 'Positive 👍' },
              { value: 'dislike', label: 'Negative 👎' },
              { value: 'neutral', label: 'Neutral 😐' }
            ]}
            value={feedbackForm.reaction}
            onChange={(val) => setFeedbackForm(prev => ({ ...prev, reaction: val as any || 'neutral' }))}
            required
          />
          
          <TextInput
            label="Category (Optional)"
            placeholder="e.g., accuracy, speed, usability"
            value={feedbackForm.category}
            onChange={(e) => setFeedbackForm(prev => ({ ...prev, category: e.target.value }))}
          />
          
          <Textarea
            label="Note (Optional)"
            placeholder="Additional feedback details"
            value={feedbackForm.note}
            onChange={(e) => setFeedbackForm(prev => ({ ...prev, note: e.target.value }))}
            minRows={3}
          />
          
          <TextInput
            label="Source"
            value={feedbackForm.source}
            onChange={(e) => setFeedbackForm(prev => ({ ...prev, source: e.target.value }))}
            placeholder="e.g., web_app, mobile_app, api"
            required
          />
          
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setSubmitModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitFeedback} disabled={!feedbackForm.request_id}>
              Submit Feedback
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
