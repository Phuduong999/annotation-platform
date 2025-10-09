import { Container, Title, Text, Button, Stack } from '@mantine/core';
import { useState } from 'react';
import { userSchema } from '@monorepo/shared';

function App() {
  const [count, setCount] = useState(0);
  const [health, setHealth] = useState<string>('Unknown');

  const checkHealth = async () => {
    try {
      const response = await fetch('http://localhost:4000/health');
      const data = await response.json();
      setHealth(data.status);
    } catch (error) {
      setHealth('Error connecting to API');
    }
  };

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Title order={1}>Monorepo Web App</Title>
        <Text size="lg">Built with Vite + React + TypeScript + Mantine</Text>
        
        <div>
          <Text size="sm" c="dimmed">Using shared schema: {userSchema.shape.email._def.typeName}</Text>
        </div>

        <div>
          <Button onClick={() => setCount((c) => c + 1)}>
            Count: {count}
          </Button>
        </div>

        <div>
          <Button onClick={checkHealth} variant="outline">
            Check API Health
          </Button>
          <Text mt="xs">API Status: {health}</Text>
        </div>
      </Stack>
    </Container>
  );
}

export default App;
