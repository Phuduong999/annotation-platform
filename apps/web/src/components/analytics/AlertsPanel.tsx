import React, { useState } from 'react';
import {
  Table,
  Badge,
  Button,
  Group,
  Text,
  ActionIcon,
  Tooltip,
  Paper,
  Select,
  TextInput,
  Box,
  Timeline,
  Avatar,
  Card,
  Tabs,
  ThemeIcon,
} from '@mantine/core';
import {
  IconBell,
  IconAlertTriangle,
  IconAlertCircle,
  IconInfoCircle,
  IconCheck,
  IconX,
  IconSearch,
  IconFilter,
  IconClock,
  IconUser,
} from '@tabler/icons-react';
import { format, formatDistance } from 'date-fns';

interface Alert {
  id: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  message: string;
  metricValue: number;
  threshold: number;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
}

interface AlertsPanelProps {
  alerts: Alert[];
  onAcknowledge: (alertId: string) => void;
}

const severityColors: Record<string, string> = {
  low: 'blue',
  medium: 'yellow',
  high: 'orange',
  critical: 'red',
};

const severityIcons: Record<string, any> = {
  low: IconInfoCircle,
  medium: IconAlertCircle,
  high: IconAlertTriangle,
  critical: IconBell,
};

function AlertCard({ alert, onAcknowledge }: { alert: Alert; onAcknowledge: (id: string) => void }) {
  const Icon = severityIcons[alert.severity];
  const color = severityColors[alert.severity];

  return (
    <Card shadow="sm" p="md" radius="md" withBorder mb="sm">
      <Group justify="space-between" mb="xs">
        <Group>
          <ThemeIcon size="lg" radius="md" color={color} variant="light">
            <Icon size={24} />
          </ThemeIcon>
          <Box>
            <Text size="sm" fw={600}>{alert.ruleName}</Text>
            <Text size="xs" c="dimmed">
              {formatDistance(new Date(alert.triggeredAt), new Date(), { addSuffix: true })}
            </Text>
          </Box>
        </Group>
        
        <Group>
          <Badge color={color} variant="light" size="lg">
            {alert.severity.toUpperCase()}
          </Badge>
          <Badge
            color={alert.status === 'active' ? 'red' : alert.status === 'acknowledged' ? 'yellow' : 'green'}
            variant="filled"
          >
            {alert.status}
          </Badge>
        </Group>
      </Group>

      <Text size="sm" mb="md">{alert.message}</Text>

      <Group justify="space-between">
        <Group gap={4}>
          <Text size="xs" c="dimmed">Value:</Text>
          <Text size="xs" fw={600}>{alert.metricValue.toFixed(2)}</Text>
          <Text size="xs" c="dimmed">/ Threshold:</Text>
          <Text size="xs" fw={600}>{alert.threshold}</Text>
        </Group>

        {alert.status === 'active' && (
          <Button
            size="xs"
            variant="light"
            color={color}
            onClick={() => onAcknowledge(alert.id)}
            leftSection={<IconCheck size={14} />}
          >
            Acknowledge
          </Button>
        )}
      </Group>

      {alert.acknowledgedAt && (
        <Box mt="sm" pt="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
          <Group gap={4}>
            <IconUser size={14} color="gray" />
            <Text size="xs" c="dimmed">
              Acknowledged by {alert.acknowledgedBy} {formatDistance(new Date(alert.acknowledgedAt), new Date(), { addSuffix: true })}
            </Text>
          </Group>
        </Box>
      )}
    </Card>
  );
}

export function AlertsPanel({ alerts, onAcknowledge }: AlertsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>('active');
  const [view, setView] = useState<'cards' | 'table' | 'timeline'>('cards');

  const filteredAlerts = alerts.filter(alert => {
    if (searchQuery && !alert.message.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !alert.ruleName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (severityFilter && alert.severity !== severityFilter) {
      return false;
    }
    if (statusFilter && alert.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const activeCount = alerts.filter(a => a.status === 'active').length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && a.status === 'active').length;

  return (
    <Box>
      {/* Stats Bar */}
      <Group mb="md">
        <Paper shadow="xs" p="sm" radius="md" withBorder>
          <Group>
            <IconBell size={20} />
            <Box>
              <Text size="xs" c="dimmed">Active Alerts</Text>
              <Text size="lg" fw={700}>{activeCount}</Text>
            </Box>
          </Group>
        </Paper>
        
        <Paper shadow="xs" p="sm" radius="md" withBorder>
          <Group>
            <IconAlertTriangle size={20} color="red" />
            <Box>
              <Text size="xs" c="dimmed">Critical</Text>
              <Text size="lg" fw={700} c="red">{criticalCount}</Text>
            </Box>
          </Group>
        </Paper>

        <Paper shadow="xs" p="sm" radius="md" withBorder>
          <Group>
            <IconClock size={20} />
            <Box>
              <Text size="xs" c="dimmed">Avg Resolution</Text>
              <Text size="lg" fw={700}>24m</Text>
            </Box>
          </Group>
        </Paper>
      </Group>

      {/* Filters */}
      <Paper shadow="xs" p="md" radius="md" mb="md">
        <Group>
          <TextInput
            placeholder="Search alerts..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          
          <Select
            placeholder="All Severities"
            data={[
              { value: '', label: 'All Severities' },
              { value: 'critical', label: 'Critical' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
            value={severityFilter}
            onChange={setSeverityFilter}
            clearable
            leftSection={<IconFilter size={16} />}
            style={{ width: 150 }}
          />
          
          <Select
            placeholder="All Statuses"
            data={[
              { value: '', label: 'All Statuses' },
              { value: 'active', label: 'Active' },
              { value: 'acknowledged', label: 'Acknowledged' },
              { value: 'resolved', label: 'Resolved' },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            style={{ width: 150 }}
          />

          <Button.Group>
            <Button
              variant={view === 'cards' ? 'filled' : 'default'}
              size="sm"
              onClick={() => setView('cards')}
            >
              Cards
            </Button>
            <Button
              variant={view === 'table' ? 'filled' : 'default'}
              size="sm"
              onClick={() => setView('table')}
            >
              Table
            </Button>
            <Button
              variant={view === 'timeline' ? 'filled' : 'default'}
              size="sm"
              onClick={() => setView('timeline')}
            >
              Timeline
            </Button>
          </Button.Group>
        </Group>
      </Paper>

      {/* Alert List */}
      {view === 'cards' && (
        <Box>
          {filteredAlerts.map(alert => (
            <AlertCard key={alert.id} alert={alert} onAcknowledge={onAcknowledge} />
          ))}
        </Box>
      )}

      {view === 'table' && (
        <Paper shadow="xs" radius="md" withBorder>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Severity</Table.Th>
                <Table.Th>Rule</Table.Th>
                <Table.Th>Message</Table.Th>
                <Table.Th>Value</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Triggered</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredAlerts.map(alert => {
                const Icon = severityIcons[alert.severity];
                return (
                  <Table.Tr key={alert.id}>
                    <Table.Td>
                      <Badge color={severityColors[alert.severity]} leftSection={<Icon size={12} />}>
                        {alert.severity}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{alert.ruleName}</Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={1}>
                        {alert.message}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {alert.metricValue.toFixed(2)} / {alert.threshold}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={alert.status === 'active' ? 'red' : alert.status === 'acknowledged' ? 'yellow' : 'green'}
                      >
                        {alert.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {formatDistance(new Date(alert.triggeredAt), new Date(), { addSuffix: true })}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {alert.status === 'active' && (
                        <Tooltip label="Acknowledge">
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="blue"
                            onClick={() => onAcknowledge(alert.id)}
                          >
                            <IconCheck size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {view === 'timeline' && (
        <Paper shadow="xs" p="md" radius="md" withBorder>
          <Timeline active={-1} bulletSize={24} lineWidth={2}>
            {filteredAlerts.map(alert => {
              const Icon = severityIcons[alert.severity];
              return (
                <Timeline.Item
                  key={alert.id}
                  bullet={<Icon size={14} />}
                  color={severityColors[alert.severity]}
                  title={alert.ruleName}
                >
                  <Text c="dimmed" size="xs">
                    {format(new Date(alert.triggeredAt), 'PPpp')}
                  </Text>
                  <Text size="sm" mt={4}>
                    {alert.message}
                  </Text>
                  <Group mt="xs" gap="xs">
                    <Badge size="sm" color={severityColors[alert.severity]}>
                      {alert.severity}
                    </Badge>
                    <Badge
                      size="sm"
                      color={alert.status === 'active' ? 'red' : alert.status === 'acknowledged' ? 'yellow' : 'green'}
                    >
                      {alert.status}
                    </Badge>
                  </Group>
                </Timeline.Item>
              );
            })}
          </Timeline>
        </Paper>
      )}

      {filteredAlerts.length === 0 && (
        <Paper shadow="xs" p="xl" radius="md" ta="center">
          <IconCheck size={48} color="green" style={{ marginBottom: 16 }} />
          <Text size="lg" fw={600} mb="xs">No alerts found</Text>
          <Text size="sm" c="dimmed">
            {searchQuery || severityFilter || statusFilter
              ? 'Try adjusting your filters'
              : 'All systems are operating normally'}
          </Text>
        </Paper>
      )}
    </Box>
  );
}