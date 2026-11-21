import { Table, Text } from '@mantine/core';
import type { WebhookAttemptDto, WebhookDeliveryStatus } from '@mintit/types';
import type { CSSProperties } from 'react';
import { HEADING, MUTED, WEBHOOK_STATUS_COLORS } from '@/src/lib/theme';
import { formatDate } from '@/src/utils';
import { ColorBadge } from './InvoicePanel';

const COLUMNS = [
  'Event',
  'Status',
  'Attempts',
  'Last Response',
  'Next Attempt',
  'Created',
];

const headStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: MUTED,
  fontFamily: HEADING,
  whiteSpace: 'nowrap',
};

const cellStyle: CSSProperties = {
  fontSize: 12,
  fontFamily: HEADING,
  color: 'var(--mantine-color-dark-0)',
  verticalAlign: 'top',
};

function WebhookStatusBadge({ status }: { status: WebhookDeliveryStatus }) {
  return <ColorBadge status={status} colors={WEBHOOK_STATUS_COLORS[status]} />;
}

export function WebhooksTable({ webhooks }: { webhooks: WebhookAttemptDto[] }) {
  if (webhooks.length === 0) {
    return (
      <Text style={{ fontSize: 12, fontFamily: HEADING, color: MUTED }}>
        No deliveries yet. A webhook is sent when the invoice is seen,
        confirmed, underpaid, expired or cancelled.
      </Text>
    );
  }

  return (
    <Table.ScrollContainer minWidth={640} type="native">
      <Table>
        <Table.Thead>
          <Table.Tr>
            {COLUMNS.map((h) => (
              <Table.Th key={h} style={headStyle}>
                {h}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {webhooks.map((w) => (
            <Table.Tr key={w.id}>
              <Table.Td style={cellStyle}>{w.event}</Table.Td>
              <Table.Td style={cellStyle}>
                <WebhookStatusBadge status={w.status} />
              </Table.Td>
              <Table.Td style={cellStyle}>{w.attempts}</Table.Td>
              <Table.Td style={{ ...cellStyle, wordBreak: 'break-word' }}>
                {w.lastError ??
                  (w.lastResponseCode ? `HTTP ${w.lastResponseCode}` : '—')}
              </Table.Td>
              <Table.Td style={cellStyle}>
                {w.status === 'pending' ? formatDate(w.nextAttemptAt) : '—'}
              </Table.Td>
              <Table.Td style={cellStyle}>{formatDate(w.createdAt)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
