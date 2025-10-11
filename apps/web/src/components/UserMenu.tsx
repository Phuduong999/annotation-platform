import { Menu, UnstyledButton, Group, Avatar, Text, Badge } from '@mantine/core';
import { IconLogout, IconUser, IconSettings } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const roleColors = {
    admin: 'red',
    annotator: 'blue',
    viewer: 'gray',
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Menu shadow="md" width={200}>
      <Menu.Target>
        <UnstyledButton>
          <Group gap="xs">
            <Avatar color={roleColors[user.role]} radius="xl" size="sm">
              {user.username[0].toUpperCase()}
            </Avatar>
            <div style={{ flex: 1 }}>
              <Text size="sm" fw={500}>{user.full_name || user.username}</Text>
              <Badge size="xs" color={roleColors[user.role]}>{user.role}</Badge>
            </div>
          </Group>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Account</Menu.Label>
        <Menu.Item leftSection={<IconUser size={14} />}>
          {user.email}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<IconLogout size={14} />}
          onClick={handleLogout}
        >
          Logout
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
