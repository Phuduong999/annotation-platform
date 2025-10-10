import { Container, Title, Text, Stack, Card } from '@mantine/core';
import { IconMessageCircle } from '@tabler/icons-react';

export function Feedback() {
  return (
    <Container size="lg" py="md">
      <Stack gap="lg">
        <div>
          <Title order={1}>Feedback</Title>
          <Text size="sm" c="dimmed" mt="xs">
            End-user feedback and sentiment tracking
          </Text>
        </div>

        <Card withBorder p="xl">
          <Stack align="center" gap="md">
            <IconMessageCircle size={48} stroke={1.5} />
            <Text size="lg" fw={500}>
              Feedback Dashboard
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              Track user reactions and feedback on task results
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
