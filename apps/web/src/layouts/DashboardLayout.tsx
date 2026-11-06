import { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  AppShell,
  Box,
  Burger,
  Divider,
  Group,
  Select,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import {
  IconChevronLeft,
  IconChevronRight,
  IconCoinMoneroFilled,
  IconFileInvoice,
  IconLayoutDashboard,
  IconLogout,
  IconSettings,
  IconUser,
  IconWallet,
} from '@tabler/icons-react';
import { ChainProvider, useChain } from '@/src/context/ChainContext';
import { Chain } from '@mintit/types';
import { api } from '@/src/lib/api';
import { PageLoader } from '@/src/components/PageLoader';
import { BORDER, CARD_BORDER, HEADING, PRIMARY } from '@/src/lib/theme';

const NAV_ITEMS = [
  { icon: IconLayoutDashboard, label: 'Overview', path: '/' },
  { icon: IconFileInvoice, label: 'Invoices', path: '/invoices' },
  { icon: IconWallet, label: 'Wallet', path: '/wallet' },
  { icon: IconSettings, label: 'Settings', path: '/settings' },
  { icon: IconUser, label: 'Profile', path: '/profile' },
];

const ACTIVE_BG = 'var(--mantine-color-dark-6)';
const HOVER_BG = 'var(--mantine-color-dark-5)';
const INACTIVE_COLOR = 'var(--mantine-color-dark-1)';

interface NavItemProps {
  icon: React.FC<{ size?: number; stroke?: number }>;
  label: string;
  path: string;
  collapsed: boolean;
  onClick?: () => void;
}

function NavItem({
  icon: Icon,
  label,
  path,
  collapsed,
  onClick,
}: NavItemProps) {
  const { pathname } = useLocation();
  const [hovered, setHovered] = useState(false);
  const active = path === '/' ? pathname === path : pathname.startsWith(path);

  return (
    <Tooltip label={label} position="right" disabled={!collapsed}>
      <UnstyledButton
        component={Link}
        to={path}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 12px',
          borderRadius: 8,
          textDecoration: 'none',
          borderLeft: active ? `2px solid ${PRIMARY}` : '2px solid transparent',
          backgroundColor: active
            ? ACTIVE_BG
            : hovered
              ? HOVER_BG
              : 'transparent',
          color: active || hovered ? PRIMARY : INACTIVE_COLOR,
          transition: 'background-color 100ms ease, color 100ms ease',
        }}
      >
        <Icon size={20} stroke={1.5} />
        {!collapsed && (
          <Text size="sm" fw={500} style={{ fontFamily: HEADING }}>
            {label}
          </Text>
        )}
      </UnstyledButton>
    </Tooltip>
  );
}

function DashboardShell() {
  const [mobileOpen, { toggle: toggleMobile }] = useDisclosure();
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutHovered, setLogoutHovered] = useState(false);
  const [collapseHovered, setCollapseHovered] = useState(false);
  const { chain, setChain, enabledChains, multiChain, status } = useChain();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const sidebarWidth = collapsed ? 60 : 220;

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await api.post('/auth/logout');
    } finally {
      // Clear cached data (including the session check) before leaving.
      queryClient.clear();
      navigate('/login');
    }
  };

  const chainOptions = enabledChains.map((c) => ({
    value: c,
    label: c.toUpperCase(),
  }));

  if (status !== 'ready') {
    return <PageLoader />;
  }

  return (
    <AppShell
      navbar={{
        width: sidebarWidth,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpen },
      }}
      padding="xl"
    >
      <AppShell.Navbar
        style={{
          background: 'var(--mantine-color-dark-7)',
          borderRight: `1px solid ${CARD_BORDER}`,
        }}
        p="xs"
      >
        {/* Logo */}
        <Box
          style={{
            padding: '16px 12px',
            borderBottom: `1px solid ${CARD_BORDER}`,
            marginBottom: 8,
          }}
        >
          <Group justify="space-between" align="center">
            <Link
              to="/"
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <IconCoinMoneroFilled size={48} color={PRIMARY} />
              {!collapsed && (
                <Text
                  style={{
                    fontFamily: HEADING,
                    fontSize: 24,
                    fontWeight: 700,
                    color: 'var(--mantine-color-dark-0)',
                  }}
                >
                  mint<span style={{ color: PRIMARY }}>it</span>
                </Text>
              )}
            </Link>
            <Burger
              opened={mobileOpen}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
              color={PRIMARY}
            />
          </Group>
        </Box>

        {/* Chain switcher */}
        {!collapsed && multiChain && (
          <Box px={4} mb={8}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.1em',
                color: 'var(--mantine-color-dark-2)',
                textTransform: 'uppercase',
                marginBottom: 6,
                paddingLeft: 4,
              }}
            >
              Chain
            </Text>
            <Select
              data={chainOptions}
              value={chain}
              onChange={(v) => v && setChain(v as Chain)}
              size="xs"
              styles={{
                input: {
                  background: 'var(--mantine-color-dark-6)',
                  border: `1px solid ${CARD_BORDER}`,
                  color: PRIMARY,
                  fontFamily: HEADING,
                  fontWeight: 600,
                  fontSize: 12,
                },
              }}
            />
          </Box>
        )}

        <Divider color={BORDER} mb={8} />

        {/* Nav items */}
        <Stack gap={2} flex={1}>
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.path}
              {...item}
              collapsed={collapsed}
              onClick={toggleMobile}
            />
          ))}
        </Stack>

        {/* Bottom */}
        <Box>
          <Divider color={BORDER} mb={8} />

          <Tooltip label="Sign out" position="right" disabled={!collapsed}>
            <UnstyledButton
              onClick={handleLogout}
              disabled={loggingOut}
              onMouseEnter={() => setLogoutHovered(true)}
              onMouseLeave={() => setLogoutHovered(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                width: '100%',
                borderRadius: 8,
                backgroundColor:
                  logoutHovered && !loggingOut ? HOVER_BG : 'transparent',
                color:
                  logoutHovered && !loggingOut ? '#f87171' : INACTIVE_COLOR,
                opacity: loggingOut ? 0.6 : 1,
                cursor: loggingOut ? 'not-allowed' : 'pointer',
                transition: 'background-color 100ms ease, color 100ms ease',
              }}
            >
              <IconLogout size={20} stroke={1.5} />
              {!collapsed && (
                <Text size="sm" fw={500} style={{ fontFamily: HEADING }}>
                  Sign out
                </Text>
              )}
            </UnstyledButton>
          </Tooltip>

          <Tooltip label={collapsed ? 'Expand' : 'Collapse'} position="right">
            <UnstyledButton
              onClick={() => setCollapsed((c) => !c)}
              onMouseEnter={() => setCollapseHovered(true)}
              onMouseLeave={() => setCollapseHovered(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-end',
                padding: '8px 12px',
                width: '100%',
                borderRadius: 8,
                backgroundColor: collapseHovered ? HOVER_BG : 'transparent',
                color: collapseHovered
                  ? 'var(--mantine-color-dark-0)'
                  : 'var(--mantine-color-dark-2)',
                transition: 'background-color 100ms ease, color 100ms ease',
              }}
            >
              {collapsed ? (
                <IconChevronRight size={16} />
              ) : (
                <Group gap={6}>
                  <Text size="xs" c="dimmed" style={{ fontFamily: HEADING }}>
                    Collapse
                  </Text>
                  <IconChevronLeft size={16} />
                </Group>
              )}
            </UnstyledButton>
          </Tooltip>
        </Box>
      </AppShell.Navbar>

      <AppShell.Main
        style={{
          background: 'var(--mantine-color-dark-8)',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

export default function DashboardLayout() {
  return (
    <ChainProvider>
      <DashboardShell />
    </ChainProvider>
  );
}
