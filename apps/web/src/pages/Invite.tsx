import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { apiErrorMessage } from '@/src/lib/errors';
import {
  TotpSetupModal,
  type TotpSetupData,
} from '@/src/components/TotpSetupModal';
import { CARD, CARD_BORDER, HEADING, PRIMARY, TEXT } from '@/src/lib/theme';

interface AcceptResult {
  email: string;
  totpRequired: boolean;
}

export default function Invite() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // The token rides in the fragment so it never reaches server logs.
  const token = useLocation().hash.slice(1);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [totpData, setTotpData] = useState<TotpSetupData | null>(null);
  const [totpToken, setTotpToken] = useState('');
  const [totpError, setTotpError] = useState<string | null>(null);
  const [totpLoading, setTotpLoading] = useState(false);

  const form = useForm({
    initialValues: { password: '', confirmPassword: '' },
    validate: {
      password: (v) =>
        v.length < 8 ? 'Password must be at least 8 characters' : null,
      confirmPassword: (v, values) =>
        v !== values.password ? 'Passwords do not match' : null,
    },
  });

  // Drops any other account's cached session and data before entering.
  const enter = () => {
    queryClient.clear();
    navigate('/', { replace: true });
  };

  const handleSubmit = form.onSubmit(async ({ password }) => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post<AcceptResult>('/auth/invite/accept', {
        token,
        password,
      });
      if (!data.totpRequired) {
        await api.post('/auth/login', { email: data.email, password });
        enter();
        return;
      }
      const setup = await api.post<TotpSetupData>('/auth/setup', {
        email: data.email,
        password,
      });
      setCredentials({ email: data.email, password });
      setTotpData(setup.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  });

  const handleTotpVerify = async (code = totpToken) => {
    if (!credentials || !code) return;
    setTotpError(null);
    setTotpLoading(true);
    try {
      await api.post('/auth/verify', { ...credentials, token: code });
      enter();
    } catch (err) {
      setTotpError(apiErrorMessage(err, 'Invalid code. Please try again.'));
    } finally {
      setTotpLoading(false);
    }
  };

  return (
    <>
      <TotpSetupModal
        opened={!!totpData}
        data={totpData}
        token={totpToken}
        onTokenChange={setTotpToken}
        onConfirm={handleTotpVerify}
        error={totpError}
        loading={totpLoading}
        confirmLabel="Confirm and sign in"
      />

      <Box
        style={{
          minHeight: '100vh',
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
              {'// invitation'}
            </Text>
            <Title
              order={2}
              style={{ color: TEXT, fontFamily: HEADING, fontWeight: 700 }}
            >
              Join mintit
            </Title>
            <Text size="sm" c="dimmed">
              Choose a password, then set up two-factor authentication.
            </Text>
          </Stack>

          <Paper
            p="xl"
            radius="sm"
            style={{ background: CARD, border: `1px solid ${CARD_BORDER}` }}
          >
            {!token ? (
              <Alert color="red" radius="sm" p="sm">
                This link is incomplete. Ask an admin for a new invite link.
              </Alert>
            ) : (
              <form onSubmit={handleSubmit}>
                <Stack gap={8}>
                  {error && (
                    <Alert color="red" radius="sm" p="sm">
                      {error}. If it has expired or was already used, ask an
                      admin for a new link.
                    </Alert>
                  )}
                  <PasswordInput
                    label="Password"
                    placeholder="At least 8 characters"
                    size="md"
                    {...form.getInputProps('password')}
                  />
                  <PasswordInput
                    label="Confirm password"
                    placeholder="Repeat your password"
                    size="md"
                    {...form.getInputProps('confirmPassword')}
                  />
                  <Button
                    type="submit"
                    color="brand"
                    fullWidth
                    size="md"
                    mt={8}
                    loading={loading}
                    disabled={!!credentials}
                    style={{ fontFamily: HEADING }}
                  >
                    Continue
                  </Button>
                </Stack>
              </form>
            )}
          </Paper>
        </Box>
      </Box>
    </>
  );
}
