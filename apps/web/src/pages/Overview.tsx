import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Divider,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  IconCircleCheck,
  IconCircleX,
  IconAlertCircle,
} from '@tabler/icons-react';
import { isAxiosError } from 'axios';
import { api } from '@/src/lib/api';
import { useReadyChain } from '@/src/context/ChainContext';
import { CARD_BORDER, HEADING, MUTED, PRIMARY } from '@/src/lib/theme';
import type { HealthReadyDto, HealthSyncedDto } from '@mintit/types';

interface HealthResponse {
  live: { status: string };
  ready: HealthReadyDto;
  synced: HealthSyncedDto;
}

interface Stats {
  confirmedVolumeAtomic: string;
}

const CHAIN_DISPLAY: Record<string, { symbol: string; decimals: number }> = {
  xmr: { symbol: 'XMR', decimals: 12 },
};

// /health/ready responds with a non-2xx status when degraded, but the body
// still carries the full check breakdown — recover it instead of losing the
// whole panel to a rejected Promise.all.
async function fetchHealthCheck<T>(path: string, chain: string): Promise<T> {
  try {
    const { data } = await api.get<T>(path, { params: { chain } });
    return data;
  } catch (err) {
    if (isAxiosError(err) && err.response?.data) {
      return err.response.data as T;
    }
    throw err;
  }
}

async function fetchHealth(chain: string): Promise<HealthResponse> {
  const [live, ready, synced] = await Promise.all([
    fetchHealthCheck<{ status: string }>('/health/live', chain),
    fetchHealthCheck<HealthReadyDto>('/health/ready', chain),
    fetchHealthCheck<HealthSyncedDto>('/health/synced', chain),
  ]);
  return { live, ready, synced };
}

async function fetchStats(chain: string): Promise<Stats> {
  const { data } = await api.get('/admin/stats', { params: { chain } });
  return data;
}

export default function Overview() {
  const chain = useReadyChain();

  const { data, isLoading } = useQuery({
    queryKey: ['health', chain],
    queryFn: () => fetchHealth(chain),
    refetchInterval: 10_000,
  });

  const { data: stats } = useQuery({
    queryKey: ['stats', chain],
    queryFn: () => fetchStats(chain),
    refetchInterval: 15_000,
  });

  const live = data?.live;
  const ready = data?.ready;
  const synced = data?.synced;

  const chainDisplay = CHAIN_DISPLAY[chain] ?? CHAIN_DISPLAY.xmr;
  const volumeDisplay = `${(
    Number(stats?.confirmedVolumeAtomic) /
    10 ** chainDisplay.decimals
  ).toFixed(chainDisplay.decimals >= 12 ? 3 : 2)} ${chainDisplay.symbol}`;

  return (
    <Stack gap="xl">
      {/* Header */}
      <Box>
        <Group gap={10} mb={4}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              color: MUTED,
              textTransform: 'uppercase',
              fontFamily: HEADING,
            }}
          >
            {`// ${chain.toUpperCase()} Network`}
          </Text>
          <Divider style={{ flex: 1 }} color="dark.5" />
        </Group>
        <Title
          order={2}
          style={{ fontFamily: HEADING, letterSpacing: '-0.02em' }}
        >
          Overview
        </Title>
      </Box>

      {/* Status cards */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <StatusCard label="Live" status={live?.status} loading={isLoading} />
        <StatusCard label="Ready" status={ready?.status} loading={isLoading} />
        <StatusCard
          label="Syncing"
          status={synced?.status}
          loading={isLoading}
        />
      </SimpleGrid>

      {/* Readiness checks */}
      {ready && (
        <SectionCard title="Readiness Checks">
          <Stack gap={0}>
            {Object.entries(ready.checks).map(([key, check]) => (
              <CheckRow
                key={key}
                label={key.charAt(0).toUpperCase() + key.slice(1)}
                ok={check.ok}
              />
            ))}
          </Stack>
        </SectionCard>
      )}

      {/* Node status */}
      {synced && (
        <SectionCard title="Node Status">
          <Stack gap="md">
            <Grid>
              <Grid.Col span={4}>
                <StatBox
                  label="Block Height"
                  value={synced.daemonHeight.toLocaleString()}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <StatBox
                  label="Wallet Height"
                  value={synced.walletHeight.toLocaleString()}
                  accent
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <StatBox
                  label="Total Volume"
                  value={stats ? volumeDisplay : '—'}
                />
              </Grid.Col>
            </Grid>
            <SyncBar
              walletHeight={synced.walletHeight}
              daemonHeight={synced.daemonHeight}
            />
          </Stack>
        </SectionCard>
      )}
    </Stack>
  );
}

function StatusCard({
  label,
  status,
  loading,
}: {
  label: string;
  status?: string;
  loading: boolean;
}) {
  const ok = status === 'ok';

  return (
    <Paper
      p="md"
      radius="sm"
      style={{
        background: 'var(--mantine-color-dark-7)',
        border: `1px solid ${ok && !loading ? CARD_BORDER : 'var(--mantine-color-dark-5)'}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {ok && !loading && (
        <Box
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${PRIMARY}66, transparent)`,
          }}
        />
      )}
      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed" style={{ fontFamily: HEADING }}>
          {label}
        </Text>
        {loading ? (
          <Skeleton height={16} width={40} radius="sm" />
        ) : ok ? (
          <Group gap={6}>
            <IconCircleCheck size={14} color={PRIMARY} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: PRIMARY,
                fontFamily: HEADING,
                letterSpacing: '0.08em',
              }}
            >
              OK
            </Text>
          </Group>
        ) : (
          <Group gap={6}>
            <IconCircleX size={14} color="#f87171" />
            <Text
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#f87171',
                fontFamily: HEADING,
                letterSpacing: '0.08em',
              }}
            >
              DOWN
            </Text>
          </Group>
        )}
      </Group>
    </Paper>
  );
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Group
      justify="space-between"
      py="xs"
      style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}
    >
      <Group gap={8}>
        {ok ? (
          <IconCircleCheck size={14} color={PRIMARY} />
        ) : (
          <IconAlertCircle size={14} color="#f87171" />
        )}
        <Text size="sm">{label}</Text>
      </Group>
      <Text
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: ok ? PRIMARY : '#f87171',
          fontFamily: HEADING,
          background: ok ? `${PRIMARY}11` : 'rgba(248,113,113,0.08)',
          border: `1px solid ${ok ? PRIMARY + '33' : 'rgba(248,113,113,0.25)'}`,
          borderRadius: 4,
          padding: '2px 8px',
        }}
      >
        {ok ? 'OPERATIONAL' : 'DOWN'}
      </Text>
    </Group>
  );
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Box
      style={{
        background: 'var(--mantine-color-dark-6)',
        border: `1px solid ${accent ? CARD_BORDER : 'var(--mantine-color-dark-5)'}`,
        borderRadius: 8,
        padding: '14px 16px',
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: MUTED,
          marginBottom: 6,
          fontFamily: HEADING,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: accent ? PRIMARY : 'var(--mantine-color-dark-0)',
          fontFamily: HEADING,
          letterSpacing: '-0.01em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Text>
    </Box>
  );
}

function SyncBar({
  walletHeight,
  daemonHeight,
}: {
  walletHeight: number;
  daemonHeight: number;
}) {
  const pct =
    daemonHeight > 0 ? Math.min((walletHeight / daemonHeight) * 100, 100) : 0;
  const synced = pct >= 99.9;

  return (
    <Box>
      <Group justify="space-between" mb={6}>
        <Text
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: MUTED,
            fontFamily: HEADING,
          }}
        >
          Sync Progress
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: synced ? PRIMARY : 'var(--mantine-color-dark-1)',
            fontFamily: HEADING,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {pct.toFixed(2)}%
        </Text>
      </Group>
      <Box
        style={{
          height: 3,
          background: 'var(--mantine-color-dark-5)',
          borderRadius: 99,
          overflow: 'hidden',
        }}
      >
        <Box
          style={{
            height: '100%',
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${PRIMARY}99, ${PRIMARY})`,
            borderRadius: 99,
            boxShadow: synced ? `0 0 8px ${PRIMARY}66` : 'none',
            transition: 'width 0.6s ease',
          }}
        />
      </Box>
    </Box>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Paper
      p="lg"
      radius="sm"
      style={{
        background: 'var(--mantine-color-dark-7)',
        border: `1px solid var(--mantine-color-dark-5)`,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: MUTED,
          fontFamily: HEADING,
          marginBottom: 16,
        }}
      >
        {title}
      </Text>
      {children}
    </Paper>
  );
}
