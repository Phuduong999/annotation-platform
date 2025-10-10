import { Container, Title, Text, Stack, Card, SimpleGrid, Paper, Group } from '@mantine/core';
import { IconChartBar, IconTrendingUp, IconUsers, IconClock } from '@tabler/icons-react';

export function Analytics() {
  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <div>
          <Title order={1}>Analytics</Title>
          <Text size="sm" c="dimmed" mt="xs">
            Performance metrics and insights
          </Text>
        </div>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
          <Paper withBorder p="md" radius="md">
            <Group>
              <IconChartBar size={32} stroke={1.5} />
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Total Tasks
                </Text>
                <Text size="xl" fw={700}>
                  -
                </Text>
              </div>
            </Group>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Group>
              <IconTrendingUp size={32} stroke={1.5} />
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Completion Rate
                </Text>
                <Text size="xl" fw={700}>
                  -
                </Text>
              </div>
            </Group>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Group>
              <IconUsers size={32} stroke={1.5} />
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Active Users
                </Text>
                <Text size="xl" fw={700}>
                  -
                </Text>
              </div>
            </Group>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Group>
              <IconClock size={32} stroke={1.5} />
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Avg. Time
                </Text>
                <Text size="xl" fw={700}>
                  -
                </Text>
              </div>
            </Group>
          </Paper>
        </SimpleGrid>

        <Card withBorder>
          <Text size="sm" c="dimmed" ta="center" py="xl">
            Analytics dashboard coming soon...
          </Text>
        </Card>
      </Stack>
    </Container>
  );
}
