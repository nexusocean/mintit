import { Group, Stack, Text } from '@mantine/core';
import type { InvoiceDto, InvoiceStatus } from '@mintit/types';
import { HEADING, MUTED, STATUS_COLORS } from '@/src/lib/theme';
import { formatDate, formatAtomic } from '@/src/utils';
import { CopyIcon } from './CopyIcon';

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const s = STATUS_COLORS[status];
  return (
    <Text
      style={{
        display: 'inline-block',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 4,
        padding: '2px 8px',
        fontFamily: HEADING,
      }}
    >
      {status}
    </Text>
  );
}

export function InvoicePanel({ invoice }: { invoice: InvoiceDto }) {
  const ticker = invoice.asset.toUpperCase();

  // Identifiers people paste elsewhere get a copy button.
  const copyable = new Set(['Public ID', 'Address', 'Tx Hash']);

  const rows: [string, string][] = [
    ['Public ID', invoice.publicId],
    ['Chain', invoice.chain.toUpperCase()],
    ['Address', invoice.address],
    [
      'Amount',
      formatAtomic(invoice.amountAtomic, invoice.assetDecimals, ticker),
    ],
    [
      'Received',
      formatAtomic(invoice.receivedAtomic, invoice.assetDecimals, ticker),
    ],
    [
      'Amount (Fiat)',
      `${invoice.amountFiat.toFixed(2)} ${invoice.fiatCurrency}`,
    ],
    ['Rate', `${invoice.rate.toFixed(6)} ${ticker}/${invoice.fiatCurrency}`],
    ['Status', invoice.status],
    [
      'Confirmations',
      `${invoice.confirmations} / ${invoice.confirmationsRequired}`,
    ],
    ['Created', formatDate(invoice.createdAt)],
    ['Expires', formatDate(invoice.expiresAt)],
    ...(invoice.memo ? [['Memo', invoice.memo] as [string, string]] : []),
    ...(invoice.firstSeenAt
      ? [['First Seen', formatDate(invoice.firstSeenAt)] as [string, string]]
      : []),
    ...(invoice.paidAt
      ? [['Paid', formatDate(invoice.paidAt)] as [string, string]]
      : []),
    ...(invoice.chainData?.txHash
      ? [['Tx Hash', String(invoice.chainData.txHash)] as [string, string]]
      : []),
  ];

  return (
    <Stack gap={0}>
      {rows.map(([label, value]) => (
        <Group
          key={label}
          gap="md"
          py="xs"
          style={{ borderBottom: `1px solid var(--mantine-color-dark-5)` }}
          wrap="wrap"
          align="flex-start"
        >
          <Text
            w={{ base: '100%', xs: 120 }}
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: MUTED,
              fontFamily: HEADING,
              flexShrink: 0,
            }}
          >
            {label}
          </Text>
          <Group
            gap={4}
            wrap="nowrap"
            align="flex-start"
            style={{ flex: 1, minWidth: 0 }}
          >
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
              {value}
            </Text>
            {copyable.has(label) && (
              <CopyIcon value={value} label={`Copy ${label}`} />
            )}
          </Group>
        </Group>
      ))}
    </Stack>
  );
}
