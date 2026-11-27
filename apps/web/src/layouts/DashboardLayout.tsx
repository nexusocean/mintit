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
  useMantineTheme,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
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
  IconUsers,
  IconWallet,
} from '@tabler/icons-react';
import { ChainProvider, useChain } from '@/src/context/ChainContext';
import { Chain } from '@mintit/types';
import { api } from '@/src/lib/api';
import { PageLoader } from '@/src/components/PageLoader';
import { useIsAdmin } from '@/src/lib/session';
import { BORDER, CARD_BORDER, HEADING, PRIMARY } from '@/src/lib/theme';

const NAV_ITEMS = [
  { icon: IconLayoutDashboard, label: 'Overview', path: '/' },
  { icon: IconFileInvoice, label: 'Invoices', path: '/invoices' },
  { icon: IconWallet, label: 'Wallet', path: '/wallet', adminOnly: true },
  { icon: IconUsers, label: 'Users', path: '/users', adminOnly: true },
  { icon: IconSettings, label: 'Settings', path: '/settings', adminOnly: true },
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
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 12,
          padding: collapsed ? '10px 0' : '10px 12px',
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
        <Icon size={collapsed ? 24 : 20} stroke={1.5} />
        {!collapsed && (
          <Text size="sm" fw={500} style={{ fontFamily: HEADING }}>
            {label}
          </Text>
        )}
      </UnstyledButton>
    </Tooltip>
  );
}

function Logo({ compact }: { compact: boolean }) {
  return (
    <Link
      to="/"
      className="logo-link"
      style={{
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <IconCoinMoneroFilled size={compact ? 36 : 48} color={PRIMARY} />
      {!compact && (
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
  );
}

function DashboardShell() {
  const [mobileOpen, { toggle: toggleMobile, close: closeMobile }] =
    useDisclosure();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const [desktopCollapsed, setCollapsed] = useState(false);
  // The mobile drawer is full width, so the icon-only mode makes no sense there.
  const collapsed = desktopCollapsed && !isMobile;
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutHovered, setLogoutHovered] = useState(false);
  const [collapseHovered, setCollapseHovered] = useState(false);
  const { chain, setChain, enabledChains, multiChain, status } = useChain();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();
  const navItems = NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly);

  const sidebarWidth = collapsed ? 72 : 220;

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
      header={{ height: 64, collapsed: !isMobile }}
      navbar={{
        width: sidebarWidth,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpen },
      }}
      padding="xl"
    >
      <AppShell.Header
        hiddenFrom="sm"
        px="md"
        style={{
          background: 'var(--mantine-color-dark-7)',
          borderBottom: `1px solid ${CARD_BORDER}`,
        }}
      >
        <Group h="100%" justify="space-between" align="center">
          <Logo compact />
          <Burger
            opened={mobileOpen}
            onClick={toggleMobile}
            size="sm"
            color={PRIMARY}
            aria-label="Toggle navigation"
          />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar
        style={{
          background: 'var(--mantine-color-dark-7)',
          borderRight: `1px solid ${CARD_BORDER}`,
        }}
        p="xs"
      >
        {/* Logo (the mobile header already shows it) */}
        <Box
          visibleFrom="sm"
          style={{
            padding: collapsed ? '16px 0' : '16px 12px',
            borderBottom: `1px solid ${CARD_BORDER}`,
            marginBottom: 8,
          }}
        >
          <Group justify={collapsed ? 'center' : 'flex-start'} align="center">
            <Logo compact={collapsed} />
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

        {/* This only sets the chain switcher apart. */}
        {!collapsed && multiChain && <Divider color={BORDER} mb={8} />}

        {/* Nav items */}
        <Stack gap={2} flex={1}>
          {navItems.map(({ adminOnly: _adminOnly, ...item }) => (
            <NavItem
              key={item.path}
              {...item}
              collapsed={collapsed}
              onClick={closeMobile}
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
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 12,
                padding: collapsed ? '10px 0' : '10px 12px',
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
              <IconLogout size={collapsed ? 24 : 20} stroke={1.5} />
              {!collapsed && (
                <Text size="sm" fw={500} style={{ fontFamily: HEADING }}>
                  Sign out
                </Text>
              )}
            </UnstyledButton>
          </Tooltip>

          <Tooltip label={collapsed ? 'Expand' : 'Collapse'} position="right">
            <UnstyledButton
              visibleFrom="sm"
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
                <IconChevronRight size={20} />
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
