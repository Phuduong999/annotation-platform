import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppShell as MantineAppShell,
  Burger,
  Group,
  Title,
  NavLink,
  Text,
  Badge,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconChecklist,
  IconUpload,
  IconChartBar,
  IconFileExport,
  IconAlertTriangle,
  IconMessageCircle,
  IconEye,
  IconApi,
} from '@tabler/icons-react';
import { UserMenu } from './UserMenu';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: string;
}

const navItems: NavItem[] = [
  {
    label: 'Tasks',
    path: '/tasks',
    icon: <IconChecklist size={20} />,
  },
  {
    label: 'Import CSV',
    path: '/import',
    icon: <IconUpload size={20} />,
  },
  {
    label: 'Analytics',
    path: '/analytics',
    icon: <IconChartBar size={20} />,
  },
  {
    label: 'Export',
    path: '/export',
    icon: <IconFileExport size={20} />,
  },
  {
    label: 'Reviews',
    path: '/reviews',
    icon: <IconEye size={20} />,
  },
  {
    label: 'Feedback',
    path: '/feedback',
    icon: <IconMessageCircle size={20} />,
  },
  {
    label: 'Alerts',
    path: '/alerts',
    icon: <IconAlertTriangle size={20} />,
    badge: 'Beta',
  },
  {
    label: 'API Docs',
    path: '/api-docs',
    icon: <IconApi size={20} />,
  },
];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [opened, { toggle }] = useDisclosure();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <MantineAppShell
      header={{ height: 60 }}
      navbar={{
        width: 280,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={3} style={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
              D4T4L4B3lXAI
            </Title>
          </Group>
          <UserMenu />
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="md">
        <MantineAppShell.Section grow>
          <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb="sm">
            Navigation
          </Text>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              label={item.label}
              leftSection={item.icon}
              rightSection={
                item.badge ? (
                  <Badge size="xs" variant="filled" color="blue">
                    {item.badge}
                  </Badge>
                ) : null
              }
              active={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                if (opened) toggle();
              }}
              variant="subtle"
              mb="xs"
            />
          ))}
        </MantineAppShell.Section>

        <MantineAppShell.Section>
          <Text size="xs" c="dimmed" ta="center">
            v1.0.0 • {new Date().getFullYear()}
          </Text>
        </MantineAppShell.Section>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>{children}</MantineAppShell.Main>
    </MantineAppShell>
  );
}
