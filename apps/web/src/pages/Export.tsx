import { Container, Title, Text, Stack, Button, Card } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';

export function Export() {
  return (
    <Container size="lg" py="md">
      <Stack gap="lg">
        <div>
          <Title order={1}>Export</Title>
          <Text size="sm" c="dimmed" mt="xs">
            Export task data and create snapshots
          </Text>
        </div>

        <Card withBorder p="xl">
          <Stack align="center" gap="md">
            <IconDownload size={48} stroke={1.5} />
            <Text size="lg" fw={500}>
              Export Functionality
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              Create snapshots of task data and export to CSV format
            </Text>
            <Button disabled>Coming Soon</Button>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
