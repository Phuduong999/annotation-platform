import { Container, Title, Text, Stack, Card } from '@mantine/core';
import { IconEye } from '@tabler/icons-react';

export function Reviews() {
  return (
    <Container size="lg" py="md">
      <Stack gap="lg">
        <div>
          <Title order={1}>Reviews</Title>
          <Text size="sm" c="dimmed" mt="xs">
            Review and quality check task annotations
          </Text>
        </div>

        <Card withBorder p="xl">
          <Stack align="center" gap="md">
            <IconEye size={48} stroke={1.5} />
            <Text size="lg" fw={500}>
              Review System
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              Quality assurance and peer review for completed tasks
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
