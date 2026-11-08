import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCheck } from '@tabler/icons-react';
import axios from 'axios';
import { api } from '@/src/lib/api';
import {
  TotpSetupModal,
  type TotpSetupData,
} from '@/src/components/TotpSetupModal';
import { HEADING, MUTED } from '@/src/lib/theme';

const labelStyles = {
  label: {
    fontFamily: HEADING,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: MUTED,
  },
};

function resetErrorMessage(err: unknown, fallback: string): string {
  if (!axios.isAxiosError(err)) return 'Something went wrong';
  const status = err.response?.status;
  if (status === 429) return 'Too many attempts, try again in a minute';
  if (status === 403 || status === 400) {
    const message = err.response?.data?.message;
    return typeof message === 'string' ? message : fallback;
  }
  return 'Something went wrong';
}

const totpStatusKey = ['auth', 'totp-status'] as const;

function ResetTotp() {
  const queryClient = useQueryClient();
  const { data: totpStatus } = useQuery({
    queryKey: totpStatusKey,
    queryFn: async () => {
      const { data } = await api.get<{ backupCodesRemaining: number }>(
        '/auth/totp/status',
      );
      return data;
    },
  });
  const remaining = totpStatus?.backupCodesRemaining;

  const [password, setPassword] = useState('');
  const [startError, setStartError] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<TotpSetupData | null>(null);
  const [token, setToken] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const start = useMutation({
    mutationFn: async (pw: string) => {
      const { data } = await api.post<TotpSetupData>('/auth/totp/reset', {
        password: pw,
      });
      return data;
    },
    onSuccess: (data) => {
      setPassword('');
      setToken('');
      setConfirmError(null);
      setSetupData(data);
    },
    onError: (err) => setStartError(resetErrorMessage(err, 'Invalid password')),
  });

  const confirm = useMutation({
    mutationFn: async (code: string) => {
      await api.post('/auth/totp/reset/confirm', { token: code });
    },
    onSuccess: () => {
      setSetupData(null);
      void queryClient.invalidateQueries({ queryKey: totpStatusKey });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
    onError: (err) =>
      setConfirmError(
        resetErrorMessage(err, 'Invalid code. Please try again.'),
      ),
  });

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setStartError('Current password is required');
      return;
    }
    setStartError(null);
    setSuccess(false);
    start.mutate(password);
  };

  const handleConfirm = (code = token) => {
    if (code.length !== 6 || confirm.isPending) return;
    setConfirmError(null);
    confirm.mutate(code);
  };

  return (
    <>
      <TotpSetupModal
        opened={setupData !== null}
        data={setupData}
        token={token}
        onTokenChange={setToken}
        onConfirm={handleConfirm}
        error={confirmError}
        loading={confirm.isPending}
        confirmLabel="Confirm new authenticator"
        onCancel={() => setSetupData(null)}
      />

      <Paper
        p="xl"
        radius="sm"
        style={{
          background: 'var(--mantine-color-dark-7)',
          border: `1px solid var(--mantine-color-dark-5)`,
        }}
      >
        <form onSubmit={handleStart}>
          <Stack gap="md">
            <Box>
              <Text
                style={{ fontFamily: HEADING, fontSize: 14, fontWeight: 600 }}
              >
                Reset two-factor authentication
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                Generates a new authenticator secret and backup codes. Your
                current authenticator keeps working until you confirm the new
                one.
              </Text>
              {remaining !== undefined && (
                <Text
                  size="xs"
                  mt={8}
                  c={remaining <= 2 ? 'orange' : 'dimmed'}
                  style={{ fontFamily: HEADING }}
                >
                  {remaining === 1
                    ? '1 backup code remaining'
                    : `${remaining} backup codes remaining`}
                  {remaining <= 2 && ' — consider resetting to get new ones'}
                </Text>
              )}
            </Box>

            <PasswordInput
              label="Current Password"
              placeholder="Required to reset"
              autoComplete="current-password"
              size="sm"
              styles={labelStyles}
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              error={startError === 'Current password is required'}
            />

            {startError && (
              <Alert
                color="red"
                radius="sm"
                p="sm"
                styles={{ message: { fontSize: 12 } }}
              >
                {startError}
              </Alert>
            )}

            {success && (
              <Group gap={6}>
                <IconCheck size={13} color="var(--mantine-color-green-5)" />
                <Text
                  style={{
                    fontSize: 12,
                    color: 'var(--mantine-color-green-5)',
                    fontFamily: HEADING,
                  }}
                >
                  Two-factor authentication reset
                </Text>
              </Group>
            )}

            <Button
              type="submit"
              color="brand"
              variant="outline"
              fullWidth
              size="sm"
              loading={start.isPending}
              style={{ fontFamily: HEADING, marginTop: 4 }}
            >
              Reset 2FA
            </Button>
          </Stack>
        </form>
      </Paper>
    </>
  );
}

export default function Profile() {
  const [success, setSuccess] = useState(false);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get('/auth/me');
      return data;
    },
  });

  const { data: status } = useQuery({
    queryKey: ['auth', 'status'],
    queryFn: async () => {
      const { data } = await api.get<{
        totpRequired: boolean;
        profileLocked: boolean;
      }>('/auth/status');
      return data;
    },
  });

  const form = useForm({
    initialValues: { email: '', password: '', newPassword: '' },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Invalid email'),
      password: (v) => (v.length < 1 ? 'Current password is required' : null),
      newPassword: (v) =>
        v.length > 0 && v.length < 8 ? 'Min 8 characters' : null,
    },
  });

  useEffect(() => {
    if (me?.email) form.setFieldValue('email', me.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const mutation = useMutation({
    mutationFn: async ({
      email,
      password,
      newPassword,
    }: {
      email: string;
      password: string;
      newPassword: string;
    }) => {
      await api.patch('/auth/update', {
        email,
        password,
        ...(newPassword ? { newPassword } : {}),
      });
    },
    onSuccess: () => {
      form.setFieldValue('password', '');
      form.setFieldValue('newPassword', '');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const errorStatus = axios.isAxiosError(mutation.error)
    ? mutation.error.response?.status
    : undefined;
  const errorMessage =
    errorStatus === 401
      ? 'Invalid credentials'
      : errorStatus === 403
        ? 'Profile updates are disabled in demo mode'
        : mutation.error
          ? 'Something went wrong'
          : null;

  const handleSubmit = form.onSubmit((values) => {
    setSuccess(false);
    mutation.mutate(values);
  });

  return (
    <Box maw={480}>
      <Stack gap="xl">
        <Title
          order={2}
          style={{ fontFamily: HEADING, letterSpacing: '-0.02em' }}
        >
          Profile
        </Title>

        <Paper
          p="xl"
          radius="sm"
          style={{
            background: 'var(--mantine-color-dark-7)',
            border: `1px solid var(--mantine-color-dark-5)`,
          }}
        >
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <Text
                style={{ fontFamily: HEADING, fontSize: 14, fontWeight: 600 }}
              >
                Update email or password
              </Text>
              <TextInput
                label="Email"
                placeholder="you@example.com"
                autoComplete="email"
                size="sm"
                styles={{
                  label: {
                    fontFamily: HEADING,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: MUTED,
                  },
                }}
                {...form.getInputProps('email')}
              />
              <PasswordInput
                label="Current Password"
                placeholder="Required to save changes"
                autoComplete="current-password"
                size="sm"
                styles={{
                  label: {
                    fontFamily: HEADING,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: MUTED,
                  },
                }}
                {...form.getInputProps('password')}
              />
              <PasswordInput
                label={
                  <Group gap={6}>
                    <Text
                      style={{
                        fontFamily: HEADING,
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: MUTED,
                      }}
                    >
                      New Password
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: 'var(--mantine-color-dark-3)',
                      }}
                    >
                      (optional)
                    </Text>
                  </Group>
                }
                placeholder="Min 8 characters"
                autoComplete="new-password"
                size="sm"
                {...form.getInputProps('newPassword')}
              />

              {errorMessage && (
                <Alert
                  color="red"
                  radius="sm"
                  p="sm"
                  styles={{ message: { fontSize: 12 } }}
                >
                  {errorMessage}
                </Alert>
              )}

              {success && (
                <Group gap={6}>
                  <IconCheck size={13} color="var(--mantine-color-green-5)" />
                  <Text
                    style={{
                      fontSize: 12,
                      color: 'var(--mantine-color-green-5)',
                      fontFamily: HEADING,
                    }}
                  >
                    Updated successfully
                  </Text>
                </Group>
              )}

              <Button
                type="submit"
                color="brand"
                fullWidth
                size="sm"
                loading={mutation.isPending}
                style={{ fontFamily: HEADING, marginTop: 4 }}
              >
                Save changes
              </Button>
            </Stack>
          </form>
        </Paper>

        {/* Shown in demo mode too; the API refuses the reset there, like
            profile updates. */}
        {status?.totpRequired && <ResetTotp />}
      </Stack>
    </Box>
  );
}
