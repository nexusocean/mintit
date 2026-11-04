import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ActionIcon,
  Box,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconCheck,
  IconCircleCheck,
  IconCircleX,
  IconCopy,
  IconEye,
  IconEyeOff,
} from '@tabler/icons-react';
import { api, type XmrWalletInfo } from '@/src/lib/api';
import type { WalletInfoDto } from '@mintit/types';
import { useReadyChain } from '@/src/context/ChainContext';
import { HEADING, MUTED, PRIMARY } from '@/src/lib/theme';

async function fetchWallet(chain: string): Promise<WalletInfoDto> {
  const { data } = await api.get('/admin/wallet', { params: { chain } });
  return data;
}

export default function Wallet() {
  const chain = useReadyChain();
  const { data, isLoading } = useQuery({
    queryKey: ['wallet', chain],
    queryFn: () => fetchWallet(chain),
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return (
      <Stack gap="xl">
        <Skeleton height={28} width={200} radius="sm" />
        <Skeleton height={160} radius="sm" />
      </Stack>
    );
  }

  if (!data) {
    return (
      <Text size="sm" c="red">
        Failed to load wallet info
      </Text>
    );
  }

  if (chain === 'xmr') return <XmrWallet data={data as XmrWalletInfo} />;

  return chain satisfies never;
}

function XmrWallet({ data }: { data: XmrWalletInfo }) {
  return (
    <Box maw={640}>
      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <Title
            order={2}
            style={{ fontFamily: HEADING, letterSpacing: '-0.02em' }}
          >
            Wallet — XMR
          </Title>
          <SyncBadge
            ok={data.synced}
            label={data.synced ? 'Synced' : 'Syncing'}
          />
        </Group>
        <SectionCard title="Keys & Identity">
          <Field
            label="Primary Address"
            value={data.primaryAddress}
            mono
            copyable
          />
          <Field label="View Key" value={data.viewKey} mono copyable masked />
          <Field
            label="Restore Height"
            value={data.restoreHeight.toLocaleString()}
            mono
          />
        </SectionCard>
      </Stack>
    </Box>
  );
}

function Field({
  label,
  value,
  mono = false,
  copyable = false,
  masked = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  masked?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const display = masked && !revealed ? '•'.repeat(16) : value;

  return (
    <Group
      gap="md"
      py="xs"
      wrap="nowrap"
      align="flex-start"
      style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: MUTED,
          fontFamily: HEADING,
          width: 140,
          flexShrink: 0,
          paddingTop: 2,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 12,
          fontFamily: mono ? HEADING : undefined,
          color: 'var(--mantine-color-dark-0)',
          wordBreak: 'break-all',
          flex: 1,
        }}
      >
        {display}
      </Text>
      <Group gap={4} style={{ flexShrink: 0 }}>
        {masked && (
          <Tooltip label={revealed ? 'Hide' : 'Reveal'} position="top">
            <ActionIcon
              variant="subtle"
              size="sm"
              color="gray"
              onClick={() => setRevealed((r) => !r)}
            >
              {revealed ? <IconEyeOff size={13} /> : <IconEye size={13} />}
            </ActionIcon>
          </Tooltip>
        )}
        {copyable && (
          <Tooltip label={copied ? 'Copied!' : 'Copy'} position="top">
            <ActionIcon
              variant="subtle"
              size="sm"
              color={copied ? 'green' : 'gray'}
              onClick={copy}
            >
              {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Group>
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

function SyncBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Group
      gap={6}
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        fontFamily: HEADING,
        color: ok ? PRIMARY : '#fcd34d',
        background: ok ? `${PRIMARY}11` : 'rgba(252,211,77,0.1)',
        border: `1px solid ${ok ? PRIMARY + '33' : 'rgba(252,211,77,0.25)'}`,
        borderRadius: 99,
        padding: '4px 12px',
      }}
    >
      {ok ? <IconCircleCheck size={13} /> : <IconCircleX size={13} />}
      <Text style={{ fontFamily: HEADING, fontSize: 11, fontWeight: 700 }}>
        {label}
      </Text>
    </Group>
  );
}
