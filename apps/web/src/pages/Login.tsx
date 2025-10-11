import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Title,
  TextInput,
  PasswordInput,
  Button,
  Checkbox,
  Stack,
  Alert,
  Text,
  Group,
} from '@mantine/core';
import { IconAlertCircle, IconLogin } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/tasks');
    }
  }, [user, navigate]);

  // Load remembered username
  useEffect(() => {
    const rememberedUsername = localStorage.getItem('remember_username');
    if (rememberedUsername) {
      setUsername(rememberedUsername);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password, rememberMe);
      navigate('/tasks');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container size={420} my={100}>
      <Paper withBorder shadow="md" p={30} radius="md">
        <Stack gap="md">
          <div>
            <Title order={2} ta="center" mb="xs">
              Welcome Back
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              Sign in to D4T4L4B3lXAI Platform
            </Text>
          </div>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <TextInput
                label="Username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />

              <PasswordInput
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Checkbox
                label="Remember me (Dev Mode)"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />

              <Button
                type="submit"
                fullWidth
                leftSection={<IconLogin size={16} />}
                loading={isLoading}
              >
                Sign In
              </Button>
            </Stack>
          </form>

          <Paper p="md" withBorder bg="gray.0">
            <Text size="xs" fw={500} mb="xs">Dev Mode Credentials:</Text>
            <Stack gap={4}>
              <Text size="xs">• admin / admin123 (Admin)</Text>
              <Text size="xs">• user123 / user123 (Annotator)</Text>
              <Text size="xs">• viewer1 / viewer123 (Viewer)</Text>
            </Stack>
          </Paper>
        </Stack>
      </Paper>
    </Container>
  );
}
