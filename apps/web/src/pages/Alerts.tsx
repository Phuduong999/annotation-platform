import { Container, Title, Text, Stack, Card, Badge, Group } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

export function Alerts() {
  return (
    <Container size="lg" py="md">
      <Stack gap="lg">
        <div>
          <Group justify="space-between" align="center">
            <div>
              <Title order={1}>Alerts</Title>
              <Text size="sm" c="dimmed" mt="xs">
                System alerts and monitoring rules
              </Text>
            </div>
            <Badge size="lg" color="blue">BETA</Badge>
          </Group>
        </div>

        <Card withBorder p="xl">
          <Stack align="center" gap="md">
            <IconAlertTriangle size={48} stroke={1.5} />
            <Text size="lg" fw={500}>
              Alert Management
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              Configure monitoring rules and receive notifications
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
