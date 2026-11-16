import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconArrowLeft, IconBan } from '@tabler/icons-react';
import { api } from '@/src/lib/api';
import { apiErrorMessage } from '@/src/lib/errors';
import { InvoiceStatus, type InvoiceDto } from '@mintit/types';
import { InvoicePanel } from '@/src/components/InvoicePanel';
import { ShareInvoiceButton } from '@/src/components/ShareInvoiceButton';
import { CARD_BORDER, HEADING, MUTED, PRIMARY } from '@/src/lib/theme';
import { ErrorGuard } from '../components/ErrorGuard';

async function fetchInvoice(publicId: string): Promise<InvoiceDto> {
  const { data } = await api.get(`/admin/invoices/${publicId}`);
  return data;
}

function CancelInvoiceButton({ invoice }: { invoice: InvoiceDto }) {
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);

  const cancel = useMutation({
    mutationFn: () =>
      api
        .post<InvoiceDto>(`/admin/invoices/${invoice.publicId}/cancel`)
        .then((r) => r.data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['invoice', invoice.publicId], updated);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setOpened(false);
    },
    // A payment may have landed meanwhile; show the invoice as it is now.
    onError: () =>
      queryClient.invalidateQueries({
        queryKey: ['invoice', invoice.publicId],
      }),
  });

  const close = () => {
    cancel.reset();
    setOpened(false);
  };

  return (
    <>
      <Button
        leftSection={<IconBan size={16} />}
        variant="subtle"
        color="red"
        size="xs"
        onClick={() => setOpened(true)}
      >
        Cancel
      </Button>
      <Modal opened={opened} onClose={close} title="Cancel invoice" centered>
        <Stack gap="md">
          {cancel.isError && (
            <Alert color="red" radius="sm" p="sm">
              {apiErrorMessage(cancel.error, 'Could not cancel the invoice')}
            </Alert>
          )}
          <Text size="sm">
            The customer&apos;s payment page will show this invoice as
            cancelled, and its webhook (if set) is notified. This can&apos;t be
            undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="outline" color="green" onClick={close}>
              Keep invoice
            </Button>
            <Button
              variant="filled"
              color="red"
              loading={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              Cancel invoice
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export default function InvoiceDetail() {
  const { publicId } = useParams<{ publicId: string }>();

  const {
    data: invoice,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['invoice', publicId],
    queryFn: () => fetchInvoice(publicId!),
    enabled: !!publicId,
  });

  if (!invoice)
    return (
      <ErrorGuard
        isLoading={isLoading}
        isError={isError}
        data={!!invoice}
        redirectTo="/invoices"
      />
    );

  const metadataEntries = Object.entries(invoice.metadata ?? {});

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

      <Group justify="space-between" align="center">
        <Title
          order={2}
          style={{ fontFamily: HEADING, letterSpacing: '-0.02em' }}
        >
          Invoice
        </Title>
        <Group gap="xs">
          {invoice.status === InvoiceStatus.Pending && (
            <CancelInvoiceButton invoice={invoice} />
          )}
          <ShareInvoiceButton publicId={invoice.publicId} />
        </Group>
      </Group>

      <Paper
        radius="sm"
        p="md"
        style={{
          background: 'var(--mantine-color-dark-7)',
          border: `1px solid ${CARD_BORDER}`,
        }}
      >
        <InvoicePanel invoice={invoice} />
      </Paper>

      {metadataEntries.length > 0 && (
        <Stack gap="sm">
          <Text
            style={{
              fontFamily: HEADING,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: PRIMARY,
            }}
          >
            {'// Metadata'}
          </Text>
          <Paper
            radius="sm"
            p="md"
            style={{
              background: 'var(--mantine-color-dark-7)',
              border: `1px solid ${CARD_BORDER}`,
            }}
          >
            <Stack gap={0}>
              {metadataEntries.map(([key, value]) => (
                <Group
                  key={key}
                  gap="md"
                  py="xs"
                  style={{
                    borderBottom: `1px solid var(--mantine-color-dark-5)`,
                  }}
                  wrap="wrap"
                  align="flex-start"
                >
                  <Text
                    w={{ base: '100%', xs: 160 }}
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: MUTED,
                      fontFamily: HEADING,
                      flexShrink: 0,
                      wordBreak: 'break-all',
                    }}
                  >
                    {key}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: HEADING,
                      color: 'var(--mantine-color-dark-0)',
                      wordBreak: 'break-all',
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {typeof value === 'string' ? value : JSON.stringify(value)}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Paper>
        </Stack>
      )}
    </Stack>
  );
}
