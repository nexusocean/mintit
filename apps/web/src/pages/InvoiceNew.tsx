import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Textarea,
  Title,
} from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { api } from '@/src/lib/api';
import { Chain, type InvoiceDto, type SettingsDto } from '@mintit/types';
import { useChain } from '@/src/context/ChainContext';
import { CARD_BORDER, HEADING, MUTED } from '@/src/lib/theme';

interface CreateInvoiceForm {
  chain: Chain | null;
  fiatAmount: number | '';
  expiresInSeconds: number | '';
  confirmationsRequired: number | '';
  memo: string;
}

const EMPTY_FORM: CreateInvoiceForm = {
  chain: null,
  fiatAmount: '',
  expiresInSeconds: '',
  confirmationsRequired: '',
  memo: '',
};

function fetchChainSettings(chain: Chain): Promise<SettingsDto> {
  return api.get('/admin/settings', { params: { chain } }).then((r) => r.data);
}

function validate(form: CreateInvoiceForm): string | null {
  if (!form.chain) return 'Select a chain';
  if (form.fiatAmount === '' || form.fiatAmount <= 0)
    return 'Enter an amount greater than 0';
  return null;
}

export default function InvoiceNew() {
  const navigate = useNavigate();
  const { enabledChains, multiChain } = useChain();
  const chainOptions = enabledChains.map((c) => ({
    value: c,
    label: c.toUpperCase(),
  }));
  // With a single chain there's nothing to pick, so preselect it (which also
  // loads its defaults right away). DashboardLayout only renders pages once
  // the chain list has loaded, so enabledChains is final here.
  const [form, setForm] = useState<CreateInvoiceForm>(() => ({
    ...EMPTY_FORM,
    chain: multiChain ? null : (enabledChains[0] ?? null),
  }));
  const [formError, setFormError] = useState<string | null>(null);

  function set<K extends keyof CreateInvoiceForm>(
    key: K,
    value: CreateInvoiceForm[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const { data: chainSettings } = useQuery({
    queryKey: ['settings', form.chain],
    queryFn: () => fetchChainSettings(form.chain!),
    enabled: !!form.chain,
  });

  useEffect(() => {
    if (!chainSettings) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((f) => ({
      ...f,
      expiresInSeconds: chainSettings.invoiceDefaultExpirySec,
      confirmationsRequired: chainSettings.confirmationDepth,
    }));
  }, [chainSettings]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/admin/invoices', {
        chain: form.chain,
        fiatAmount: form.fiatAmount === '' ? undefined : form.fiatAmount,
        expiresInSeconds:
          form.expiresInSeconds === '' ? undefined : form.expiresInSeconds,
        confirmationsRequired:
          form.confirmationsRequired === ''
            ? undefined
            : form.confirmationsRequired,
        memo: form.memo.trim() || undefined,
      });
      return data as InvoiceDto;
    },
    onSuccess: (invoice) => {
      navigate(`/invoices/${invoice.publicId}`);
    },
  });

  function handleSubmit() {
    const error = validate(form);
    setFormError(error);
    if (error) return;
    mutation.mutate();
  }

  return (
    <Stack gap="xl">
      <Anchor
        component={Link}
        to="/invoices"
        style={{
          color: MUTED,
          fontSize: 12,
          fontFamily: HEADING,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          width: 'fit-content',
        }}
      >
        <IconArrowLeft size={14} />
        Back to invoices
      </Anchor>

      <Title
        order={2}
        style={{ fontFamily: HEADING, letterSpacing: '-0.02em' }}
      >
        New Invoice
      </Title>

      <Paper
        radius="sm"
        p="md"
        maw={520}
        style={{
          background: 'var(--mantine-color-dark-7)',
          border: `1px solid ${CARD_BORDER}`,
        }}
      >
        <Stack gap="sm">
          {(mutation.isError || formError) && (
            <Alert color="red" radius="sm" p="sm">
              {formError ?? 'Failed to create invoice'}
            </Alert>
          )}

          {multiChain && (
            <Select
              label="Chain"
              placeholder="Select a chain"
              data={chainOptions}
              value={form.chain}
              onChange={(v) => set('chain', (v as Chain) ?? null)}
            />
          )}

          <NumberInput
            label="Amount"
            description="Fiat value"
            placeholder="19.99"
            min={0.01}
            decimalScale={2}
            value={form.fiatAmount}
            onChange={(v) => set('fiatAmount', v === '' ? '' : Number(v))}
          />

          <NumberInput
            label="Expiry (minutes)"
            description={
              form.chain
                ? 'Defaults to the chain setting; edit to override'
                : 'Select a chain to load the default'
            }
            min={1}
            value={
              form.expiresInSeconds === '' ? '' : form.expiresInSeconds / 60
            }
            onChange={(v) =>
              set(
                'expiresInSeconds',
                v === '' ? '' : Math.round(Number(v) * 60),
              )
            }
          />

          <NumberInput
            label="Confirmations"
            description={
              form.chain
                ? 'Defaults to the chain setting; edit to override'
                : 'Select a chain to load the default'
            }
            min={1}
            value={form.confirmationsRequired}
            onChange={(v) =>
              set('confirmationsRequired', v === '' ? '' : Number(v))
            }
          />

          <Textarea
            label="Memo"
            description="Optional"
            placeholder="Invoice for consulting services"
            maxLength={280}
            autosize
            minRows={2}
            value={form.memo}
            onChange={(e) => set('memo', e.currentTarget.value)}
          />

          <Group justify="flex-end" mt="sm">
            <Button
              component={Link}
              to="/invoices"
              variant="subtle"
              color="gray"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={mutation.isPending}
              color="brand"
              style={{ fontFamily: HEADING }}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}
