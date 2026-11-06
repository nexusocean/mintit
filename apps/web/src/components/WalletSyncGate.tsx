import { useQuery } from '@tanstack/react-query';
import { Outlet } from 'react-router-dom';
import { Center, Stack, Text } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { api } from '@/src/lib/api';
import { PageLoader } from '@/src/components/PageLoader';
import { HEADING, MUTED, PRIMARY } from '@/src/lib/theme';

interface SyncedResponse {
  status: 'ok' | 'syncing';
  walletHeight: number;
  daemonHeight: number;
  behind: number;
  detail?: string;
}

const POLL_MS = 5_000;

// Holds back the login form until the API reports the wallet as synced.
export function WalletSyncGate() {
  const { data, isPending } = useQuery({
    queryKey: ['health', 'synced'],
    queryFn: () =>
      api.get<SyncedResponse>('/health/synced').then((r) => r.data),
    refetchInterval: (query) =>
      query.state.data?.status === 'ok' ? false : POLL_MS,
    staleTime: 0,
  });

  if (isPending) return <PageLoader />;

  if (data?.status === 'ok') return <Outlet />;

  const progress =
    data && data.behind >= 0
      ? `Block ${data.walletHeight.toLocaleString()} of ${data.daemonHeight.toLocaleString()} (${data.behind.toLocaleString()} behind)`
      : 'Waiting for the wallet to connect…';

  return (
    <Center style={{ minHeight: '100vh' }}>
      <Stack align="center" gap="sm" maw={420} px="md">
        <IconRefresh className="spin" size={40} color={PRIMARY} />
        <Text
          style={{
            fontFamily: HEADING,
            fontSize: 16,
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          Wallet is syncing, please wait
        </Text>
        <Text
          style={{
            fontFamily: HEADING,
            fontSize: 13,
            color: MUTED,
            textAlign: 'center',
          }}
        >
          {progress}
          <br />
          Login will be available once the wallet has caught up with the
          network.
        </Text>
      </Stack>
    </Center>
  );
}
