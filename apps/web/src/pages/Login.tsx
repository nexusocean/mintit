import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
  Alert,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import {
  TotpSetupModal,
  type TotpSetupData,
} from '@/src/components/TotpSetupModal';
import { sessionQueryKey } from '@/src/lib/session';
import { safeNext } from '@/src/utils';
import { isAxiosError } from 'axios';
import {
  BORDER,
  CARD,
  CARD_BORDER,
  HEADING,
  MUTED,
  PRIMARY,
  TEXT,
} from '@/src/lib/theme';

type Mode = 'loading' | 'login' | 'register' | 'error';

const terminalLines: { text: string; delay: number; color?: string }[] = [
  { text: '$ mintit status', delay: 0 },
  { text: 'CHAIN    STATUS     HEIGHT', delay: 600, color: MUTED },
  { text: 'xmr      synced     3,204,891', delay: 1000, color: PRIMARY },
  { text: '', delay: 1300 },
  { text: '$ mintit invoices --status confirmed', delay: 1700 },
  { text: '✓ 3 confirmed invoices today', delay: 2500, color: PRIMARY },
];

function PanelTerminal() {
  const [visible, setVisible] = useState<number[]>([]);

  useEffect(() => {
    const timers = terminalLines.map((line, i) =>
      setTimeout(() => setVisible((v) => [...v, i]), line.delay + 300),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <Box
      style={{
        background: '#080a0d',
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 6,
        fontFamily: HEADING,
        fontSize: 12,
        padding: '14px 18px',
        width: '100%',
        maxWidth: 360,
      }}
    >
      <Group gap={6} mb={10}>
        {['#ff5f56', '#ffbd2e', '#27c93f'].map((c) => (
          <Box
            key={c}
            style={{ width: 9, height: 9, borderRadius: '50%', background: c }}
          />
        ))}
      </Group>
      {terminalLines.map((line, i) => (
        <Box
          key={i}
          style={{
            color: line.color || MUTED,
            opacity: visible.includes(i) ? 1 : 0,
            transition: 'opacity 0.4s ease',
            marginBottom: 3,
            whiteSpace: 'pre',
            minHeight: 18,
          }}
        >
          {line.text}
        </Box>
      ))}
    </Box>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <Box
      style={{
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 6,
        padding: '8px 14px',
        background: CARD,
        textAlign: 'center',
        minWidth: 90,
      }}
    >
      <Text
        style={{
          color: PRIMARY,
          fontFamily: HEADING,
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        {value}
      </Text>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
    </Box>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const [mode, setMode] = useState<Mode>('loading');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpData, setTotpData] = useState<TotpSetupData | null>(null);
  const [credentials, setCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [totpToken, setTotpToken] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [totpRequired, setTotpRequired] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/auth/status');
        setMode(data.registered ? 'login' : 'register');
        setTotpRequired(data.totpRequired !== false);
      } catch {
        setMode('error');
      }
    })();
  }, []);

  const form = useForm({
    initialValues: { email: '', password: '', confirmPassword: '' },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Invalid email'),
      password: (v) =>
        v.length < 8 ? 'Password must be at least 8 characters' : null,
      confirmPassword: (v, values) =>
        mode === 'register' && v !== values.password
          ? 'Passwords do not match'
          : null,
    },
  });

  // Drop the cached "not logged in" result so RequireAuth re-checks the session.
  const onLoggedIn = () =>
    queryClient.removeQueries({ queryKey: sessionQueryKey });

  const handleSubmit = form.onSubmit(async ({ email, password }) => {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'register' && !totpRequired) {
        // TOTP disabled (dev): the account is active right after registering.
        await api.post('/auth/register', { email, password });
        await api.post('/auth/login', { email, password });
        onLoggedIn();
        navigate(next, { replace: true });
      } else if (mode === 'register') {
        await api.post('/auth/register', { email, password });
        const { data } = await api.post('/auth/setup', { email, password });
        setTotpData(data);
        setCredentials({ email, password });
        open();
      } else {
        await api.post('/auth/login', {
          email,
          password,
          ...(totpRequired && { token: totpToken }),
        });
        onLoggedIn();
        navigate(next, { replace: true });
      }
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 401) {
        setError('Invalid credentials');
      } else if (isAxiosError(err) && err.response?.status === 429) {
        setError('Too many attempts, try again in a minute');
      } else {
        setError('Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  });

  const handleTotpVerify = async (code = totpToken) => {
    if (!credentials || !code) return;
    setTotpError(null);
    setTotpLoading(true);
    try {
      await api.post('/auth/verify', {
        email: credentials.email,
        password: credentials.password,
        token: code,
      });
      onLoggedIn();
      close();
      navigate(next, { replace: true });
    } catch (err) {
      setTotpError(
        isAxiosError(err) && err.response?.status === 429
          ? 'Too many attempts, try again in a minute'
          : 'Invalid code. Please try again.',
      );
    } finally {
      setTotpLoading(false);
    }
  };

  if (mode === 'loading') {
    return (
      <Box
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      </Box>
    );
  }

  if (mode === 'error') {
    return (
      <Box
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text size="sm" c="red">
          Service unavailable. Please try again later.
        </Text>
      </Box>
    );
  }

  return (
    <>
      <TotpSetupModal
        opened={opened}
        data={totpData}
        token={totpToken}
        onTokenChange={setTotpToken}
        onConfirm={handleTotpVerify}
        error={totpError}
        loading={totpLoading}
        confirmLabel="Confirm and sign in"
      />

      <Box style={{ flex: 1, display: 'flex', minHeight: '100vh' }}>
        <Box
          style={{
            flex: '1 1 100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
          }}
        >
          <Box style={{ width: '100%', maxWidth: 420 }}>
            <Stack gap={4} mb="xl">
              <Text
                style={{
                  color: PRIMARY,
                  fontFamily: HEADING,
                  fontSize: 12,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                }}
              >
                {mode === 'login' ? '// welcome back' : '// first time setup'}
              </Text>
              <Title
                order={2}
                style={{ color: TEXT, fontFamily: HEADING, fontWeight: 700 }}
              >
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </Title>
              <Text size="sm" c="dimmed">
                {mode === 'login'
                  ? 'Good to see you again.'
                  : 'Set up your admin account.'}
              </Text>
            </Stack>

            <Paper
              p="xl"
              radius="sm"
              style={{ background: CARD, border: `1px solid ${CARD_BORDER}` }}
            >
              <Stack gap="md">
                <form onSubmit={handleSubmit}>
                  {error && (
                    <Alert color="red" radius="sm" p="sm">
                      {error}
                    </Alert>
                  )}
                  <TextInput
                    type="email"
                    label="Email"
                    placeholder="you@example.com"
                    size="md"
                    {...form.getInputProps('email')}
                  />
                  <PasswordInput
                    type="password"
                    label="Password"
                    placeholder="Your password"
                    size="md"
                    mt={8}
                    {...form.getInputProps('password')}
                  />
                  {mode === 'register' && (
                    <PasswordInput
                      label="Confirm password"
                      placeholder="Repeat your password"
                      size="md"
                      mt={8}
                      {...form.getInputProps('confirmPassword')}
                    />
                  )}
                  {mode === 'login' && totpRequired && (
                    <>
                      <TextInput
                        label={
                          useBackupCode ? 'Backup code' : 'Authenticator code'
                        }
                        placeholder={useBackupCode ? 'XXXXXXXXXX' : '000000'}
                        maxLength={useBackupCode ? 10 : 6}
                        size="md"
                        value={totpToken}
                        mt={8}
                        onChange={(e) => setTotpToken(e.currentTarget.value)}
                      />
                    </>
                  )}
                  <Button
                    type="submit"
                    color="brand"
                    fullWidth
                    size="md"
                    mt={16}
                    loading={loading}
                    style={{ fontFamily: HEADING }}
                  >
                    {mode === 'login' ? 'Sign in' : 'Create account'}
                  </Button>

                  {mode === 'login' && totpRequired && (
                    <Button
                      size="xs"
                      c="white"
                      mt={12}
                      style={{ border: 'none' }}
                      onClick={() => {
                        setUseBackupCode((v) => !v);
                        setTotpToken('');
                      }}
                    >
                      {useBackupCode
                        ? 'Use authenticator code'
                        : 'Use a backup code'}
                    </Button>
                  )}
                </form>
              </Stack>
            </Paper>
          </Box>
        </Box>

        <Box
          visibleFrom="md"
          style={{ width: 1, background: BORDER, flexShrink: 0 }}
        />

        <Box
          visibleFrom="md"
          style={{
            flex: '0 0 60%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 32,
            padding: '48px 40px',
            background: `radial-gradient(ellipse at 60% 40%, ${PRIMARY}0d 0%, transparent 65%)`,
          }}
        >
          <Stack gap="xs" ta="center" mb={8}>
            <Title order={3} style={{ color: TEXT, fontFamily: HEADING }}>
              Your payments are running
            </Title>
            <Text size="sm" c="dimmed" maw={320}>
              Sign in to manage invoices, monitor chain status, and configure
              your processor.
            </Text>
          </Stack>
          <PanelTerminal />
          <Group gap="md" mt={8}>
            <StatChip label="chain" value="xmr" />
            <StatChip label="uptime" value="99.9%" />
            <StatChip label="privacy" value="100%" />
          </Group>
        </Box>
      </Box>
    </>
  );
}
