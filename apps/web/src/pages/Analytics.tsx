import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  Container,
  Title,
  Grid,
  Card,
  Text,
  Group,
  Stack,
  Badge,
  Progress,
  Table,
  Center,
  Loader,
  Alert,
  Paper,
  SimpleGrid,
  ThemeIcon,
} from '@mantine/core';
import {
  IconCheck,
  IconClock,
  IconAlertTriangle,
  IconThumbDown,
  IconChartBar,
  IconUsers,
  IconTarget,
  IconTrendingUp,
} from '@tabler/icons-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function Analytics() {
  // Fetch all analytics data
  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/analytics/overview`);
      return res.data.data;
    },
  });

  const { data: annotations, isLoading: loadingAnnotations } = useQuery({
    queryKey: ['analytics', 'annotations'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/analytics/annotations`);
      return res.data.data;
    },
  });

  const { data: feedback, isLoading: loadingFeedback } = useQuery({
    queryKey: ['analytics', 'feedback'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/analytics/feedback`);
      return res.data.data;
    },
  });

  const { data: dropoff, isLoading: loadingDropoff } = useQuery({
    queryKey: ['analytics', 'dropoff'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/analytics/dropoff`);
      return res.data.data;
    },
  });

  const { data: trends, isLoading: loadingTrends } = useQuery({
    queryKey: ['analytics', 'trends'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/analytics/trends`);
      return res.data.data;
    },
  });

  const { data: byType, isLoading: loadingByType } = useQuery({
    queryKey: ['analytics', 'by-type'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/analytics/by-type`);
      return res.data.data;
    },
  });

  const { data: userBehavior, isLoading: loadingUserBehavior } = useQuery({
    queryKey: ['analytics', 'user-behavior'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/analytics/user-behavior`);
      return res.data.data;
    },
  });

  const isLoading = loadingOverview || loadingAnnotations || loadingFeedback || loadingDropoff || loadingTrends || loadingByType || loadingUserBehavior;

  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <Center h={400}>
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <div>
          <Title order={1}>Analytics Dashboard</Title>
          <Text size="sm" c="dimmed" mt="xs">
            Comprehensive analysis of task annotations, feedback, and performance metrics
          </Text>
        </div>

        {/* Key Metrics */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          <Card withBorder>
            <Stack gap="xs">
              <Group justify="apart">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Total Tasks
                </Text>
                <ThemeIcon size="sm" variant="light">
                  <IconChartBar size={16} />
                </ThemeIcon>
              </Group>
              <Text size="xl" fw={700}>
                {overview?.completionRate?.total || 0}
              </Text>
            </Stack>
          </Card>

          <Card withBorder>
            <Stack gap="xs">
              <Group justify="apart">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Completion Rate
                </Text>
                <ThemeIcon size="sm" variant="light" color="green">
                  <IconCheck size={16} />
                </ThemeIcon>
              </Group>
              <Text size="xl" fw={700}>
                {overview?.completionRate?.completion_percentage || 0}%
              </Text>
              <Progress 
                value={overview?.completionRate?.completion_percentage || 0} 
                color="green" 
                size="sm" 
              />
            </Stack>
          </Card>

          <Card withBorder>
            <Stack gap="xs">
              <Group justify="apart">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Avg Duration
                </Text>
                <ThemeIcon size="sm" variant="light" color="blue">
                  <IconClock size={16} />
                </ThemeIcon>
              </Group>
              <Text size="xl" fw={700}>
                {overview?.durationStats?.avg_duration_seconds || 0}s
              </Text>
            </Stack>
          </Card>

          <Card withBorder>
            <Stack gap="xs">
              <Group justify="apart">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Active Annotators
                </Text>
                <ThemeIcon size="sm" variant="light" color="violet">
                  <IconUsers size={16} />
                </ThemeIcon>
              </Group>
              <Text size="xl" fw={700}>
                {annotations?.topAnnotators?.length || 0}
              </Text>
            </Stack>
          </Card>
        </SimpleGrid>

        {/* Status & Type Distribution */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card withBorder h="100%">
              <Stack gap="md">
                <Group justify="apart">
                  <Text size="lg" fw={600}>Task Status Distribution</Text>
                  <IconChartBar size={20} />
                </Group>
                <Stack gap="xs">
                  {overview?.statusDistribution?.map((item: any) => (
                    <Paper key={item.status} p="xs" withBorder>
                      <Group justify="apart">
                        <Group gap="xs">
                          <Badge size="sm" color={
                            item.status === 'completed' ? 'green' :
                            item.status === 'in_progress' ? 'yellow' :
                            item.status === 'pending' ? 'blue' : 'gray'
                          }>
                            {item.status}
                          </Badge>
                          <Text size="sm">{item.count} tasks</Text>
                        </Group>
                        <Text size="sm" fw={600}>{item.percentage}%</Text>
                      </Group>
                      <Progress value={item.percentage} color={
                        item.status === 'completed' ? 'green' :
                        item.status === 'in_progress' ? 'yellow' :
                        item.status === 'pending' ? 'blue' : 'gray'
                      } size="sm" mt={4} />
                    </Paper>
                  ))}
                </Stack>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card withBorder h="100%">
              <Stack gap="md">
                <Group justify="apart">
                  <Text size="lg" fw={600}>Scan Type Distribution</Text>
                  <IconTarget size={20} />
                </Group>
                <Stack gap="xs">
                  {overview?.typeDistribution?.map((item: any) => (
                    <Paper key={item.type} p="xs" withBorder>
                      <Group justify="apart">
                        <Group gap="xs">
                          <Badge size="sm" variant="light">{item.type}</Badge>
                          <Text size="sm">{item.count} tasks</Text>
                        </Group>
                        <Text size="sm" fw={600}>{item.percentage}%</Text>
                      </Group>
                      <Progress value={item.percentage} size="sm" mt={4} />
                    </Paper>
                  ))}
                </Stack>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Annotation Analysis */}
        <Card withBorder>
          <Stack gap="md">
            <Text size="lg" fw={600}>Annotation Analysis</Text>
            
            <Grid>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Paper p="md" withBorder>
                  <Text size="sm" c="dimmed" mb="xs">Classification Distribution</Text>
                  {annotations?.classificationDistribution?.slice(0, 5).map((item: any) => (
                    <Group key={item.classification} justify="apart" mb="xs">
                      <Badge size="xs" variant="dot">{item.classification}</Badge>
                      <Text size="xs">{item.count} ({item.percentage}%)</Text>
                    </Group>
                  ))}
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 4 }}>
                <Paper p="md" withBorder>
                  <Text size="sm" c="dimmed" mb="xs">Result Return</Text>
                  {annotations?.resultReturnDistribution?.map((item: any) => (
                    <Group key={item.result_return} justify="apart" mb="xs">
                      <Badge 
                        size="xs" 
                        color={item.result_return === 'correct_result' ? 'green' : 'red'}
                      >
                        {item.result_return}
                      </Badge>
                      <Text size="xs">{item.count} ({item.percentage}%)</Text>
                    </Group>
                  ))}
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 4 }}>
                <Paper p="md" withBorder>
                  <Text size="sm" c="dimmed" mb="xs">Feedback Corrections (Multi-select)</Text>
                  {annotations?.feedbackCorrectionDistribution?.slice(0, 5).map((item: any) => (
                    <Group key={item.correction_type} justify="apart" mb="xs">
                      <Text size="xs">{item.correction_type.replace(/_/g, ' ')}</Text>
                      <Badge size="xs">{item.count}</Badge>
                    </Group>
                  ))}
                </Paper>
              </Grid.Col>
            </Grid>
          </Stack>
        </Card>

        {/* Dislike Feedback Analysis */}
        <Card withBorder>
          <Stack gap="md">
            <Group justify="apart">
              <Text size="lg" fw={600}>Dislike Feedback Analysis</Text>
              <IconThumbDown size={20} color="red" />
            </Group>

            <Alert icon={<IconAlertTriangle />} color="red" variant="light">
              <Text size="sm" fw={500}>Dislike Rate Analysis</Text>
              <Text size="xs">Tasks with end-user dislike reactions by scan type</Text>
            </Alert>

            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper p="md" withBorder>
                  <Text size="sm" fw={600} mb="md">Dislikes by Scan Type</Text>
                  <Stack gap="xs">
                    {feedback?.dislikeByType?.map((item: any) => (
                      <div key={item.scan_type}>
                        <Group justify="apart" mb={4}>
                          <Badge variant="light">{item.scan_type}</Badge>
                          <Text size="sm">{item.dislike_count} dislikes</Text>
                        </Group>
                        <Progress 
                          value={item.dislike_rate || 0} 
                          color="red" 
                          size="sm"
                          label={`${item.dislike_rate}%`}
                        />
                      </div>
                    ))}
                  </Stack>
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper p="md" withBorder>
                  <Text size="sm" fw={600} mb="md">Dislike Reasons</Text>
                  {feedback?.dislikeReasons?.length > 0 ? (
                    <Stack gap="xs">
                      {feedback.dislikeReasons.map((item: any) => (
                        <Group key={item.reason} justify="apart">
                          <Text size="sm">{item.reason || 'No reason'}</Text>
                          <Badge color="red">{item.count}</Badge>
                        </Group>
                      ))}
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">No dislike reasons recorded</Text>
                  )}
                </Paper>
              </Grid.Col>
            </Grid>
          </Stack>
        </Card>

        {/* Dropoff Analysis */}
        <Card withBorder>
          <Stack gap="md">
            <Group justify="apart">
              <Text size="lg" fw={600}>Task Funnel & Dropoff Analysis</Text>
              <IconTrendingUp size={20} />
            </Group>

            {dropoff?.funnel && (
              <Grid>
                <Grid.Col span={{ base: 12, md: 9 }}>
                  <Stack gap="sm">
                    <Paper p="md" withBorder bg="blue.0">
                      <Group justify="apart">
                        <div>
                          <Text size="sm" fw={600}>1. Pending</Text>
                          <Text size="xs" c="dimmed">Tasks waiting to be started</Text>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Text size="xl" fw={700}>{dropoff.funnel.stage_1_pending.count}</Text>
                          <Text size="xs" c="dimmed">{dropoff.funnel.stage_1_pending.percentage}%</Text>
                        </div>
                      </Group>
                      <Progress value={100} color="blue" size="lg" mt="xs" />
                    </Paper>

                    <Paper p="md" withBorder bg="yellow.0">
                      <Group justify="apart">
                        <div>
                          <Text size="sm" fw={600}>2. In Progress</Text>
                          <Text size="xs" c="dimmed">Tasks currently being worked on</Text>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Text size="xl" fw={700}>{dropoff.funnel.stage_2_started.count}</Text>
                          <Text size="xs" c="dimmed">{dropoff.funnel.stage_2_started.percentage}%</Text>
                        </div>
                      </Group>
                      <Progress 
                        value={dropoff.funnel.stage_2_started.percentage} 
                        color="yellow" 
                        size="lg" 
                        mt="xs" 
                      />
                    </Paper>

                    <Paper p="md" withBorder bg="green.0">
                      <Group justify="apart">
                        <div>
                          <Text size="sm" fw={600}>3. Completed</Text>
                          <Text size="xs" c="dimmed">Successfully annotated tasks</Text>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Text size="xl" fw={700}>{dropoff.funnel.stage_3_completed.count}</Text>
                          <Text size="xs" c="dimmed">{dropoff.funnel.stage_3_completed.percentage}%</Text>
                        </div>
                      </Group>
                      <Progress 
                        value={dropoff.funnel.stage_3_completed.percentage} 
                        color="green" 
                        size="lg" 
                        mt="xs" 
                      />
                    </Paper>
                  </Stack>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 3 }}>
                  <Paper p="md" withBorder bg="red.0" h="100%">
                    <Stack gap="xs" justify="center" h="100%">
                      <Text size="sm" fw={600} c="red">Dropoff</Text>
                      <Text size="xs" c="dimmed">Tasks not completed</Text>
                      <Text size="xl" fw={700} c="red">{dropoff.funnel.dropoff.total}</Text>
                      <Stack gap={4}>
                        <Group gap="xs">
                          <Text size="xs">Skipped:</Text>
                          <Badge size="sm" color="orange">{dropoff.funnel.dropoff.skipped}</Badge>
                        </Group>
                        <Group gap="xs">
                          <Text size="xs">Failed:</Text>
                          <Badge size="sm" color="red">{dropoff.funnel.dropoff.failed}</Badge>
                        </Group>
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid.Col>
              </Grid>
            )}

            {dropoff?.staleTasks && parseInt(dropoff.staleTasks.stale_count) > 0 && (
              <Alert icon={<IconAlertTriangle />} color="orange">
                <Text size="sm" fw={500}>Stale Tasks Warning</Text>
                <Text size="xs">
                  {dropoff.staleTasks.stale_count} tasks have been in progress for over 24 hours
                  (avg: {dropoff.staleTasks.avg_hours_stale}h)
                </Text>
              </Alert>
            )}
          </Stack>
        </Card>

        {/* Top Annotators */}
        {annotations?.topAnnotators && annotations.topAnnotators.length > 0 && (
          <Card withBorder>
            <Stack gap="md">
              <Group justify="apart">
                <Text size="lg" fw={600}>Top Annotators</Text>
                <IconUsers size={20} />
              </Group>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Annotator</Table.Th>
                    <Table.Th>Annotations</Table.Th>
                    <Table.Th>Active Days</Table.Th>
                    <Table.Th>First Annotation</Table.Th>
                    <Table.Th>Last Annotation</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {annotations.topAnnotators.map((annotator: any, idx: number) => (
                    <Table.Tr key={annotator.annotator}>
                      <Table.Td>
                        <Group gap="xs">
                          <Badge size="sm" variant={idx === 0 ? 'filled' : 'light'}>
                            #{idx + 1}
                          </Badge>
                          <Text size="sm" fw={500}>{annotator.annotator}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge color="green">{annotator.annotations_count}</Badge>
                      </Table.Td>
                      <Table.Td>{annotator.active_days}</Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {new Date(annotator.first_annotation).toLocaleDateString()}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {new Date(annotator.last_annotation).toLocaleDateString()}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </Card>
        )}

        {/* Dropoff by Type */}
        {byType?.dropoffByType && byType.dropoffByType.length > 0 && (
          <Card withBorder>
            <Stack gap="md">
              <Group justify="apart">
                <Text size="lg" fw={600}>Dropoff Analysis by Scan Type</Text>
                <Badge size="lg" color="red">Top Dropoffs</Badge>
              </Group>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Scan Type</Table.Th>
                    <Table.Th>Total</Table.Th>
                    <Table.Th>Pending</Table.Th>
                    <Table.Th>In Progress</Table.Th>
                    <Table.Th>Completed</Table.Th>
                    <Table.Th>Skipped</Table.Th>
                    <Table.Th>Failed</Table.Th>
                    <Table.Th>Dropoff Rate</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {byType.dropoffByType.map((type: any) => (
                    <Table.Tr key={type.scan_type}>
                      <Table.Td>
                        <Badge variant="light">{type.scan_type}</Badge>
                      </Table.Td>
                      <Table.Td>{type.total}</Table.Td>
                      <Table.Td>
                        <Badge size="sm" color="blue">{type.pending}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" color="yellow">{type.in_progress}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" color="green">{type.completed}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" color="orange">{type.skipped}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" color="red">{type.failed}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Progress 
                            value={type.dropoff_rate || 0} 
                            color="red" 
                            size="md" 
                            style={{ width: 100 }}
                          />
                          <Text size="sm" fw={600}>{type.dropoff_rate || 0}%</Text>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </Card>
        )}

        {/* Annotation Tags by Type */}
        {byType?.tagsByType && byType.tagsByType.length > 0 && (
          <Card withBorder>
            <Stack gap="md">
              <Group justify="apart">
                <Text size="lg" fw={600}>Annotation Tags Frequency by Scan Type</Text>
                <Badge size="lg" color="violet">Multi-select Analysis</Badge>
              </Group>
              <Text size="sm" c="dimmed">
                Shows how many times each feedback correction tag appears for each scan type (multi-select field)
              </Text>
              
              {/* Group by scan_type */}
              {(() => {
                const grouped = byType.tagsByType.reduce((acc: any, item: any) => {
                  if (!acc[item.scan_type]) {
                    acc[item.scan_type] = [];
                  }
                  acc[item.scan_type].push(item);
                  return acc;
                }, {});

                return Object.keys(grouped).map((scanType: string) => (
                  <Paper key={scanType} p="md" withBorder>
                    <Text size="md" fw={600} mb="md">
                      {scanType} 
                      <Badge ml="xs" size="sm">{grouped[scanType].length} tags</Badge>
                    </Text>
                    <Grid>
                      {grouped[scanType].slice(0, 6).map((tag: any, idx: number) => (
                        <Grid.Col key={idx} span={{ base: 12, sm: 6, md: 4 }}>
                          <Paper p="xs" withBorder bg="gray.0">
                            <Group justify="apart">
                              <div>
                                <Text size="xs" c="dimmed">
                                  {tag.feedback_tag.replace(/_/g, ' ')}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  Classification: {tag.annotated_classification}
                                </Text>
                              </div>
                              <Badge size="lg" variant="filled" color="violet">
                                {tag.tag_count}
                              </Badge>
                            </Group>
                          </Paper>
                        </Grid.Col>
                      ))}
                    </Grid>
                  </Paper>
                ));
              })()}
            </Stack>
          </Card>
        )}

        {/* User Behavior - Exit Without Feedback */}
        {userBehavior?.exitWithoutFeedback && userBehavior.exitWithoutFeedback.length > 0 && (
          <Card withBorder>
            <Stack gap="md">
              <Group justify="apart">
                <Text size="lg" fw={600}>Users Who Exit Without Feedback</Text>
                <Badge size="lg" color="orange">Engagement Gap</Badge>
              </Group>
              <Alert icon={<IconAlertTriangle />} color="orange" variant="light">
                <Text size="sm" fw={500}>Low Engagement Warning</Text>
                <Text size="xs">
                  Users viewed AI results but didn't provide any feedback or take action
                </Text>
              </Alert>

              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Scan Type</Table.Th>
                    <Table.Th>Tasks Without Feedback</Table.Th>
                    <Table.Th>Unique Users</Table.Th>
                    <Table.Th>Exit Rate</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {userBehavior.exitWithoutFeedback.map((item: any) => (
                    <Table.Tr key={item.scan_type}>
                      <Table.Td>
                        <Badge variant="light">{item.scan_type}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge color="orange">{item.tasks_without_feedback}</Badge>
                      </Table.Td>
                      <Table.Td>{item.unique_users}</Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Progress 
                            value={item.exit_rate || 0} 
                            color="orange" 
                            size="md" 
                            style={{ width: 100 }}
                          />
                          <Text size="sm" fw={600}>{item.exit_rate}%</Text>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </Card>
        )}

        {/* Engagement Funnel */}
        {userBehavior?.engagementMetrics && (
          <Card withBorder>
            <Stack gap="md">
              <Group justify="apart">
                <Text size="lg" fw={600}>User Engagement Funnel</Text>
                <IconTrendingUp size={20} />
              </Group>
              <Text size="sm" c="dimmed">
                Tracks user journey from viewing AI results to providing feedback
              </Text>

              <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
                <Paper p="md" withBorder bg="blue.0">
                  <Stack gap="xs" align="center">
                    <Text size="xs" c="dimmed" tt="uppercase">AI Result Shown</Text>
                    <Text size="xl" fw={700}>{userBehavior.engagementMetrics.ai_result_shown}</Text>
                    <Progress value={100} color="blue" size="sm" style={{ width: '100%' }} />
                    <Text size="xs" fw={600}>100%</Text>
                  </Stack>
                </Paper>

                <Paper p="md" withBorder bg="yellow.0">
                  <Stack gap="xs" align="center">
                    <Text size="xs" c="dimmed" tt="uppercase">Task Started</Text>
                    <Text size="xl" fw={700}>{userBehavior.engagementMetrics.task_started.count}</Text>
                    <Progress value={userBehavior.engagementMetrics.task_started.rate} color="yellow" size="sm" style={{ width: '100%' }} />
                    <Text size="xs" fw={600}>{userBehavior.engagementMetrics.task_started.rate}%</Text>
                  </Stack>
                </Paper>

                <Paper p="md" withBorder bg="green.0">
                  <Stack gap="xs" align="center">
                    <Text size="xs" c="dimmed" tt="uppercase">Task Completed</Text>
                    <Text size="xl" fw={700}>{userBehavior.engagementMetrics.task_completed.count}</Text>
                    <Progress value={userBehavior.engagementMetrics.task_completed.rate} color="green" size="sm" style={{ width: '100%' }} />
                    <Text size="xs" fw={600}>{userBehavior.engagementMetrics.task_completed.rate}%</Text>
                  </Stack>
                </Paper>

                <Paper p="md" withBorder bg="violet.0">
                  <Stack gap="xs" align="center">
                    <Text size="xs" c="dimmed" tt="uppercase">Feedback Given</Text>
                    <Text size="xl" fw={700}>{userBehavior.engagementMetrics.feedback_given.count}</Text>
                    <Progress value={userBehavior.engagementMetrics.feedback_given.rate} color="violet" size="sm" style={{ width: '100%' }} />
                    <Text size="xs" fw={600}>{userBehavior.engagementMetrics.feedback_given.rate}%</Text>
                  </Stack>
                </Paper>
              </SimpleGrid>
            </Stack>
          </Card>
        )}

        {/* Daily Trend */}
        {trends?.dailyTrend && trends.dailyTrend.length > 0 && (
          <Card withBorder>
            <Stack gap="md">
              <Text size="lg" fw={600}>Completion Trend (Last 14 Days)</Text>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Completed</Table.Th>
                    <Table.Th>Avg Duration</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {trends.dailyTrend.map((day: any) => (
                    <Table.Tr key={day.date}>
                      <Table.Td>{new Date(day.date).toLocaleDateString()}</Table.Td>
                      <Table.Td>
                        <Badge>{day.completed_count}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{day.avg_duration_seconds}s</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </Card>
        )}
      </Stack>
    </Container>
  );
}
