import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Group,
  NumberInput,
  Paper,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { isAxiosError } from 'axios';
import { api } from '@/src/lib/api';
import type { SettingsDto, GlobalSettingsDto } from '@mintit/types';
import { useReadyChain } from '@/src/context/ChainContext';
import { HEADING, MUTED } from '@/src/lib/theme';

// display: how a field's stored (backend) value is converted for editing in the UI.
// 'sec-to-min' divides by 60 for display and multiplies by 60 on save (stored unit: seconds).
// 'ms-to-sec' divides by 1000 for display and multiplies by 1000 on save (stored unit: ms).
type FieldDisplay = 'none' | 'sec-to-min' | 'ms-to-sec';

const CHAIN_FIELDS: {
  key: keyof SettingsDto;
  label: string;
  unit: string;
  display: FieldDisplay;
}[] = [
  {
    key: 'confirmationDepth',
    label: 'Confirmation Depth',
    unit: 'blocks',
    display: 'none',
  },
  {
    key: 'invoiceDefaultExpirySec',
    label: 'Invoice Default Expiry',
    unit: 'minutes',
    display: 'sec-to-min',
  },
  {
    key: 'scannerLockTtlMs',
    label: 'Scanner Lock TTL',
    unit: 'seconds',
    display: 'ms-to-sec',
  },
  {
    key: 'syncedThresholdBlocks',
    label: 'Sync Threshold',
    unit: 'blocks',
    display: 'none',
  },
];

const GLOBAL_FIELDS: {
  key: keyof GlobalSettingsDto;
  label: string;
  unit: string;
  display: FieldDisplay;
}[] = [
  {
    key: 'rateCacheTtlMs',
    label: 'Rate Cache TTL',
    unit: 'seconds',
    display: 'ms-to-sec',
  },
  {
    key: 'webhookMaxAttempts',
    label: 'Webhook Max Attempts',
    unit: 'retries',
    display: 'none',
  },
  {
    key: 'webhookTimeoutMs',
    label: 'Webhook Timeout',
    unit: 'seconds',
    display: 'ms-to-sec',
  },
  {
    key: 'webhookDispatchIntervalMs',
    label: 'Webhook Dispatch Interval',
    unit: 'seconds',
    display: 'ms-to-sec',
  },
];

function toDisplay(value: number, display: FieldDisplay): number {
  if (display === 'sec-to-min') return value / 60;
  if (display === 'ms-to-sec') return value / 1000;
  return value;
}

function fromDisplay(value: number, display: FieldDisplay): number {
  if (display === 'sec-to-min') return Math.round(value * 60);
  if (display === 'ms-to-sec') return Math.round(value * 1000);
  return value;
}

function fetchSettings(chain: string): Promise<SettingsDto> {
  return api.get('/admin/settings', { params: { chain } }).then((r) => r.data);
}

function fetchGlobalSettings(): Promise<GlobalSettingsDto> {
  return api.get('/admin/settings/global').then((r) => r.data);
}

function FieldList({
  fields,
  draft,
  onChange,
}: {
  fields: { key: string; label: string; unit: string; display: FieldDisplay }[];
  draft: Record<string, number>;
  onChange: (
    key: string,
    value: string | number,
    display: FieldDisplay,
  ) => void;
}) {
  return (
    <Paper
      radius="sm"
      style={{
        background: 'var(--mantine-color-dark-7)',
        border: `1px solid var(--mantine-color-dark-5)`,
        overflow: 'hidden',
      }}
    >
      {fields.map(({ key, label, unit, display }, i) => (
        <Box
          key={String(key)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            padding: '10px 20px',
            borderBottom:
              i < fields.length - 1
                ? '1px solid var(--mantine-color-dark-5)'
                : 'none',
          }}
        >
          <Text
            w={{ base: '100%', xs: 220 }}
            style={{
              fontSize: 13,
              color: 'var(--mantine-color-dark-0)',
              fontFamily: HEADING,
              flexShrink: 0,
            }}
          >
            {label}
          </Text>
          <Group gap="sm" align="center">
            <NumberInput
              value={toDisplay(draft[key], display)}
              onChange={(v) => onChange(key, v, display)}
              min={0}
              hideControls
              size="xs"
              styles={{
                input: {
                  width: 120,
                  fontFamily: HEADING,
                  fontSize: 13,
                  textAlign: 'right',
                },
              }}
            />
            <Text
              style={{
                fontSize: 13,
                color: MUTED,
                fontFamily: HEADING,
                width: 52,
              }}
            >
              {unit}
            </Text>
          </Group>
        </Box>
      ))}
    </Paper>
  );
}

function SaveRow({
  dirty,
  isPending,
  saved,
  saveError,
  onSave,
}: {
  dirty: boolean;
  isPending: boolean;
  saved: boolean;
  saveError: string | null;
  onSave: () => void;
}) {
  return (
    <Group justify="flex-end" align="center" gap="sm">
      {saveError && (
        <Alert
          color="red"
          radius="sm"
          p="xs"
          styles={{ message: { fontSize: 12 } }}
        >
          {saveError}
        </Alert>
      )}
      {saved && (
        <Group gap={4}>
          <IconCheck size={13} color="var(--mantine-color-green-5)" />
          <Text
            style={{
              fontSize: 12,
              color: 'var(--mantine-color-green-5)',
              fontFamily: HEADING,
            }}
          >
            Saved
          </Text>
        </Group>
      )}
      <Button
        onClick={onSave}
        disabled={!dirty || isPending}
        loading={isPending}
        size="sm"
        color="brand"
        style={{ fontFamily: HEADING }}
      >
        {isPending ? 'Saving…' : 'Save'}
      </Button>
    </Group>
  );
}

export default function Settings() {
  const chain = useReadyChain();
  const queryClient = useQueryClient();

  const { data: chainData, isLoading: chainLoading } = useQuery({
    queryKey: ['settings', chain],
    queryFn: () => fetchSettings(chain),
  });

  const { data: globalData, isLoading: globalLoading } = useQuery({
    queryKey: ['settings', 'global'],
    queryFn: fetchGlobalSettings,
  });

  const [chainDraft, setChainDraft] = useState<SettingsDto | null>(null);
  const [globalDraft, setGlobalDraft] = useState<GlobalSettingsDto | null>(
    null,
  );

  const [chainSaved, setChainSaved] = useState(false);
  const [globalSaved, setGlobalSaved] = useState(false);
  const [chainError, setChainError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChainDraft(chainData ?? null);
  }, [chainData]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGlobalDraft(globalData ?? null);
  }, [globalData]);

  const chainMutation = useMutation({
    mutationFn: (values: SettingsDto) => {
      const chainOnly = Object.fromEntries(
        CHAIN_FIELDS.map(({ key }) => [key, values[key]]),
      );
      return api.put('/admin/settings', chainOnly, { params: { chain } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', chain] });
      setChainSaved(true);
      setChainError(null);
      setTimeout(() => setChainSaved(false), 2000);
    },
    onError: (err) => {
      setChainError(
        isAxiosError(err)
          ? (err.response?.data?.message ?? 'Failed to save')
          : 'Failed to save',
      );
    },
  });

  const globalMutation = useMutation({
    mutationFn: (values: GlobalSettingsDto) =>
      api.put('/admin/settings/global', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'global'] });
      setGlobalSaved(true);
      setGlobalError(null);
      setTimeout(() => setGlobalSaved(false), 2000);
    },
    onError: (err) => {
      setGlobalError(
        isAxiosError(err)
          ? (err.response?.data?.message ?? 'Failed to save')
          : 'Failed to save',
      );
    },
  });

  function handleChainChange(
    key: keyof SettingsDto,
    value: string | number,
    display: FieldDisplay,
  ) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return;
    const stored = fromDisplay(num, display);
    setChainDraft((prev) => (prev ? { ...prev, [key]: stored } : prev));
  }

  function handleGlobalChange(
    key: keyof GlobalSettingsDto,
    value: string | number,
    display: FieldDisplay,
  ) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return;
    const stored = fromDisplay(num, display);
    setGlobalDraft((prev) => (prev ? { ...prev, [key]: stored } : prev));
  }

  if (chainLoading || globalLoading || !chainDraft || !globalDraft) {
    return (
      <Stack gap="xl">
        <Skeleton height={28} width={160} radius="sm" />
        <Skeleton height={320} radius="sm" />
        <Skeleton height={200} radius="sm" />
      </Stack>
    );
  }

  const chainDirty = JSON.stringify(chainDraft) !== JSON.stringify(chainData);
  const globalDirty =
    JSON.stringify(globalDraft) !== JSON.stringify(globalData);

  return (
    <Box maw={640}>
      <Stack gap="sm">
        <Title
          order={3}
          style={{ fontFamily: HEADING, letterSpacing: '-0.02em' }}
        >
          Monero Settings
        </Title>

        {/* Chain settings */}
        <FieldList
          fields={CHAIN_FIELDS}
          draft={chainDraft as unknown as Record<string, number>}
          onChange={(k, v, display) =>
            handleChainChange(k as keyof SettingsDto, v, display)
          }
        />
        <SaveRow
          dirty={chainDirty}
          isPending={chainMutation.isPending}
          saved={chainSaved}
          saveError={chainError}
          onSave={() => chainMutation.mutate(chainDraft)}
        />

        {/* Global settings */}
        <Title
          order={3}
          style={{ fontFamily: HEADING, letterSpacing: '-0.02em' }}
        >
          Global Settings
        </Title>
        <FieldList
          fields={GLOBAL_FIELDS}
          draft={globalDraft as unknown as Record<string, number>}
          onChange={(k, v, display) =>
            handleGlobalChange(k as keyof GlobalSettingsDto, v, display)
          }
        />
        <SaveRow
          dirty={globalDirty}
          isPending={globalMutation.isPending}
          saved={globalSaved}
          saveError={globalError}
          onSave={() => globalMutation.mutate(globalDraft)}
        />
      </Stack>
    </Box>
  );
}
