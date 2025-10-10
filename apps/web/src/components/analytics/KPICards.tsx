import React from 'react';
import {
  Grid,
  Paper,
  Text,
  Title,
  Group,
  ThemeIcon,
  Progress,
  Badge,
  Box,
  RingProgress,
  Tooltip,
} from '@mantine/core';
import {
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconChecks,
  IconRefresh,
  IconLink,
  IconThumbDown,
  IconUsers,
  IconClock,
  IconList,
  IconActivity,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { Sparkline } from '@mantine/charts';

interface KPI {
  name: string;
  value: number;
  previousValue?: number;
  change?: number;
  changePercentage?: number;
  trend?: 'up' | 'down' | 'stable';
  target?: number;
  targetMet?: boolean;
  period: string;
  sparklineData?: number[];
}

interface KPICardsProps {
  kpis: Record<string, KPI>;
  period: string;
}

const kpiIcons: Record<string, any> = {
  taskThroughput: IconActivity,
  acceptanceRate: IconChecks,
  reworkRate: IconRefresh,
  linkErrorRate: IconLink,
  dislikeRate: IconThumbDown,
  interAnnotatorAgreement: IconUsers,
  reviewThroughput: IconChecks,
  averageCompletionTime: IconClock,
  activeUsers: IconUsers,
  queueSize: IconList,
};

const kpiColors: Record<string, string> = {
  taskThroughput: 'blue',
  acceptanceRate: 'green',
  reworkRate: 'orange',
  linkErrorRate: 'red',
  dislikeRate: 'pink',
  interAnnotatorAgreement: 'violet',
  reviewThroughput: 'teal',
  averageCompletionTime: 'yellow',
  activeUsers: 'indigo',
  queueSize: 'cyan',
};

function KPICard({ kpi, name }: { kpi: KPI; name: string }) {
  const Icon = kpiIcons[name] || IconActivity;
  const color = kpiColors[name] || 'blue';
  const TrendIcon = kpi.trend === 'up' ? IconTrendingUp : kpi.trend === 'down' ? IconTrendingDown : IconMinus;
  
  // For rates and percentages, we want lower values for some metrics
  const isPositiveTrend = ['reworkRate', 'linkErrorRate', 'dislikeRate', 'averageCompletionTime'].includes(name)
    ? kpi.trend === 'down'
    : kpi.trend === 'up';

  // Format value based on metric type
  const formatValue = (value: number) => {
    if (name === 'averageCompletionTime') {
      return `${value.toFixed(1)}h`;
    }
    if (name.includes('Rate') || name === 'interAnnotatorAgreement') {
      return `${value.toFixed(1)}%`;
    }
    return value.toFixed(0);
  };

  // Generate mock sparkline data if not provided
  const sparklineData = kpi.sparklineData || Array.from({ length: 20 }, () => 
    kpi.value + (Math.random() - 0.5) * kpi.value * 0.3
  );

  return (
    <Paper shadow="xs" p="md" radius="md" withBorder>
      <Group justify="space-between" mb="xs">
        <ThemeIcon size="xl" radius="md" variant="light" color={color}>
          <Icon size={28} />
        </ThemeIcon>
        {kpi.trend && (
          <Badge
            size="sm"
            radius="sm"
            variant="light"
            color={isPositiveTrend ? 'green' : 'red'}
            leftSection={<TrendIcon size={12} />}
          >
            {kpi.changePercentage ? `${Math.abs(kpi.changePercentage).toFixed(1)}%` : 'N/A'}
          </Badge>
        )}
      </Group>

      <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb={4}>
        {kpi.name}
      </Text>
      
      <Group align="baseline" gap={4} mb="xs">
        <Title order={2}>{formatValue(kpi.value)}</Title>
        {kpi.previousValue !== undefined && (
          <Text size="sm" c="dimmed">
            from {formatValue(kpi.previousValue)}
          </Text>
        )}
      </Group>

      {kpi.target !== undefined && (
        <Box mb="xs">
          <Group justify="space-between" mb={4}>
            <Text size="xs" c="dimmed">Target: {formatValue(kpi.target)}</Text>
            <Text size="xs" c={kpi.targetMet ? 'green' : 'red'} fw={600}>
              {kpi.targetMet ? 'Met' : 'Not Met'}
            </Text>
          </Group>
          <Progress
            value={(kpi.value / kpi.target) * 100}
            size="sm"
            radius="md"
            color={kpi.targetMet ? 'green' : 'red'}
          />
        </Box>
      )}

      <Box h={50}>
        <Sparkline
          data={sparklineData}
          h={50}
          color={color}
          fillOpacity={0.2}
          strokeWidth={2}
          curveType="monotone"
        />
      </Box>
    </Paper>
  );
}

export function KPICards({ kpis, period }: KPICardsProps) {
  // Priority order for KPIs
  const priorityOrder = [
    'taskThroughput',
    'acceptanceRate',
    'reworkRate',
    'activeUsers',
    'queueSize',
    'averageCompletionTime',
    'linkErrorRate',
    'dislikeRate',
    'interAnnotatorAgreement',
    'reviewThroughput',
  ];

  const sortedKpis = Object.entries(kpis)
    .sort(([a], [b]) => {
      const aIndex = priorityOrder.indexOf(a);
      const bIndex = priorityOrder.indexOf(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    })
    .slice(0, 8); // Show top 8 KPIs

  return (
    <Grid>
      {sortedKpis.map(([name, kpi]) => (
        <Grid.Col key={name} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
          <KPICard kpi={kpi} name={name} />
        </Grid.Col>
      ))}
      
      {/* Summary Card */}
      <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
        <Paper shadow="xs" p="md" radius="md" withBorder h="100%">
          <Group justify="space-between" mb="xs">
            <ThemeIcon size="xl" radius="md" variant="light" color="grape">
              <IconAlertTriangle size={28} />
            </ThemeIcon>
            <Badge size="sm" radius="sm" variant="light" color="grape">
              Summary
            </Badge>
          </Group>
          
          <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb={4}>
            Overall Health Score
          </Text>
          
          <Box ta="center" my="md">
            <RingProgress
              size={120}
              thickness={12}
              sections={[
                { value: 40, color: 'green', tooltip: 'Good' },
                { value: 30, color: 'yellow', tooltip: 'Warning' },
                { value: 20, color: 'orange', tooltip: 'Needs Attention' },
                { value: 10, color: 'red', tooltip: 'Critical' },
              ]}
              label={
                <Box ta="center">
                  <Title order={3}>85%</Title>
                  <Text size="xs" c="dimmed">Healthy</Text>
                </Box>
              }
            />
          </Box>
          
          <Text size="xs" ta="center" c="dimmed">
            Period: {period}
          </Text>
        </Paper>
      </Grid.Col>
    </Grid>
  );
}