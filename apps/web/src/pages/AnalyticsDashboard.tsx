import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Title,
  Paper,
  Group,
  Select,
  Button,
  Tabs,
  Badge,
  ActionIcon,
  Tooltip,
  Text,
  Box,
  LoadingOverlay,
  Alert,
} from '@mantine/core';
import {
  IconRefresh,
  IconChartBar,
  IconAlertTriangle,
  IconUsers,
  IconTrendingUp,
  IconDownload,
  IconBell,
  IconInfoCircle,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { KPICards } from '../components/analytics/KPICards';
import { MetricsChart } from '../components/analytics/MetricsChart';
import { AlertsPanel } from '../components/analytics/AlertsPanel';
import { LeaderboardPanel } from '../components/analytics/LeaderboardPanel';
import { ProjectSummary } from '../components/analytics/ProjectSummary';
import { RealTimeMetrics } from '../components/analytics/RealTimeMetrics';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import { exportAnalytics } from '../services/analytics';

export function AnalyticsDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState('day');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const [isExporting, setIsExporting] = useState(false);

  const {
    kpis,
    metrics,
    alerts,
    leaderboard,
    projectSummary,
    loading,
    error,
    refetch,
    activeAlertCount,
  } = useAnalyticsData({
    period: selectedPeriod,
    projectId: selectedProject || undefined,
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
  });

  const handleExport = async (format: 'json' | 'csv') => {
    setIsExporting(true);
    try {
      await exportAnalytics({
        format,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        projectId: selectedProject || undefined,
      });
      notifications.show({
        title: 'Export Successful',
        message: `Analytics data exported as ${format.toUpperCase()}`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Export Failed',
        message: 'Failed to export analytics data',
        color: 'red',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Container fluid p="md" style={{ position: 'relative' }}>
      <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ radius: "sm", blur: 2 }} />
      
      {/* Header */}
      <Group justify="space-between" mb="md">
        <Group>
          <Title order={2}>Analytics Dashboard</Title>
          {activeAlertCount > 0 && (
            <Badge color="red" size="lg" radius="md" variant="filled">
              <Group gap={4}>
                <IconBell size={14} />
                {activeAlertCount} Active Alerts
              </Group>
            </Badge>
          )}
        </Group>
        
        <Group>
          <Select
            placeholder="Select period"
            data={[
              { value: 'day', label: 'Last 24 Hours' },
              { value: 'week', label: 'Last Week' },
              { value: 'month', label: 'Last Month' },
              { value: 'quarter', label: 'Last Quarter' },
              { value: 'year', label: 'Last Year' },
            ]}
            value={selectedPeriod}
            onChange={(value) => setSelectedPeriod(value || 'day')}
            style={{ width: 150 }}
          />
          
          <Select
            placeholder="All Projects"
            data={[
              { value: '', label: 'All Projects' },
              { value: 'project-1', label: 'Project Alpha' },
              { value: 'project-2', label: 'Project Beta' },
              { value: 'project-3', label: 'Project Gamma' },
            ]}
            value={selectedProject}
            onChange={setSelectedProject}
            clearable
            style={{ width: 150 }}
          />
          
          <Button.Group>
            <Tooltip label="Export as JSON">
              <Button
                variant="default"
                size="sm"
                onClick={() => handleExport('json')}
                loading={isExporting}
                leftSection={<IconDownload size={16} />}
              >
                JSON
              </Button>
            </Tooltip>
            <Tooltip label="Export as CSV">
              <Button
                variant="default"
                size="sm"
                onClick={() => handleExport('csv')}
                loading={isExporting}
                leftSection={<IconDownload size={16} />}
              >
                CSV
              </Button>
            </Tooltip>
          </Button.Group>
          
          <Tooltip label="Refresh data">
            <ActionIcon
              variant="default"
              size="lg"
              onClick={() => refetch()}
              disabled={loading}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {error && (
        <Alert
          icon={<IconAlertTriangle size={16} />}
          title="Error loading analytics"
          color="red"
          mb="md"
          withCloseButton
          onClose={() => {}}
        >
          {error.message || 'Failed to load analytics data. Please try again.'}
        </Alert>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="overview" leftSection={<IconChartBar size={16} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="metrics" leftSection={<IconTrendingUp size={16} />}>
            Metrics
          </Tabs.Tab>
          <Tabs.Tab 
            value="alerts" 
            leftSection={<IconAlertTriangle size={16} />}
            rightSection={
              activeAlertCount > 0 ? (
                <Badge size="xs" color="red" variant="filled">
                  {activeAlertCount}
                </Badge>
              ) : null
            }
          >
            Alerts
          </Tabs.Tab>
          <Tabs.Tab value="leaderboard" leftSection={<IconUsers size={16} />}>
            Leaderboard
          </Tabs.Tab>
          <Tabs.Tab value="project" leftSection={<IconInfoCircle size={16} />}>
            Project Details
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview">
          <Grid>
            {/* KPI Cards */}
            <Grid.Col span={12}>
              <KPICards kpis={kpis} period={selectedPeriod} />
            </Grid.Col>

            {/* Real-time Metrics */}
            <Grid.Col span={12}>
              <Paper shadow="xs" p="md" radius="md">
                <Title order={4} mb="md">Real-Time Activity</Title>
                <RealTimeMetrics projectId={selectedProject} />
              </Paper>
            </Grid.Col>

            {/* Charts Grid */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper shadow="xs" p="md" radius="md" h={400}>
                <MetricsChart
                  title="Task Throughput"
                  data={metrics?.taskThroughput || []}
                  type="line"
                  color="blue"
                  showTrend
                />
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper shadow="xs" p="md" radius="md" h={400}>
                <MetricsChart
                  title="Acceptance Rate"
                  data={metrics?.acceptanceRate || []}
                  type="area"
                  color="green"
                  yAxisSuffix="%"
                />
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper shadow="xs" p="md" radius="md" h={400}>
                <MetricsChart
                  title="Error Rates"
                  data={metrics?.errorRates || []}
                  type="bar"
                  color="red"
                  stacked
                />
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper shadow="xs" p="md" radius="md" h={400}>
                <MetricsChart
                  title="Queue Size"
                  data={metrics?.queueSize || []}
                  type="line"
                  color="orange"
                  showArea
                />
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        <Tabs.Panel value="metrics">
          <Grid>
            <Grid.Col span={12}>
              <Paper shadow="xs" p="md" radius="md">
                <MetricsChart
                  title="All Metrics Comparison"
                  data={metrics?.combined || []}
                  type="multi-line"
                  height={500}
                  showLegend
                  showTooltip
                  enableZoom
                />
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper shadow="xs" p="md" radius="md">
                <MetricsChart
                  title="Inter-Annotator Agreement"
                  data={metrics?.interAnnotatorAgreement || []}
                  type="scatter"
                  color="violet"
                  yAxisDomain={[0, 1]}
                />
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper shadow="xs" p="md" radius="md">
                <MetricsChart
                  title="API Performance"
                  data={metrics?.apiPerformance || []}
                  type="heatmap"
                  colorScheme="blues"
                />
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        <Tabs.Panel value="alerts">
          <AlertsPanel
            alerts={alerts}
            onAcknowledge={(alertId) => {
              console.log('Acknowledge alert:', alertId);
              refetch();
            }}
          />
        </Tabs.Panel>

        <Tabs.Panel value="leaderboard">
          <LeaderboardPanel
            data={leaderboard}
            period={selectedPeriod}
            metric="tasks_completed"
          />
        </Tabs.Panel>

        <Tabs.Panel value="project">
          {selectedProject ? (
            <ProjectSummary
              projectId={selectedProject}
              summary={projectSummary}
            />
          ) : (
            <Paper shadow="xs" p="xl" radius="md" ta="center">
              <Text size="lg" c="dimmed">
                Select a project to view detailed analytics
              </Text>
            </Paper>
          )}
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}