import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ActionIcon,
  Anchor,
  Button,
  Group,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsSort,
  IconChevronLeft,
  IconChevronRight,
  IconExternalLink,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react';
import { api } from '@/src/lib/api';
import { Chain, InvoiceStatus, type InvoiceListDto } from '@mintit/types';
import { useChain } from '@/src/context/ChainContext';
import { HEADING, MUTED, STATUS_COLORS } from '@/src/lib/theme';
import { formatDate, formatAtomic } from '@/src/utils';
import { StatusBadge } from '@/src/components/InvoicePanel';
import { ShareInvoiceIcon } from '@/src/components/ShareInvoiceButton';
import { PageLoader } from '../components/PageLoader';
import { CopyIcon } from '@/src/components/CopyIcon';

const STATUSES: InvoiceStatus[] = [
  InvoiceStatus.Pending,
  InvoiceStatus.Seen,
  InvoiceStatus.Confirmed,
  InvoiceStatus.Underpaid,
  InvoiceStatus.Expired,
  InvoiceStatus.Cancelled,
];

// Expired and cancelled invoices are noise day to day; one click on the chip shows them.
const DEFAULT_STATUSES = STATUSES.filter(
  (s) => s !== InvoiceStatus.Expired && s !== InvoiceStatus.Cancelled,
);

const LIMIT = 20;

type SortField = 'createdAt' | 'expiresAt' | 'amount' | 'status' | 'publicId';
type SortOrder = 'asc' | 'desc';
interface Sort {
  field: SortField;
  order: SortOrder;
}

const DEFAULT_SORT: Sort = { field: 'createdAt', order: 'desc' };
// First click on a column: biggest/newest first, but status reads in
// lifecycle order (pending → cancelled) and IDs in alphabetical order.
const FIRST_ORDER: Record<SortField, SortOrder> = {
  createdAt: 'desc',
  expiresAt: 'desc',
  publicId: 'asc',
  amount: 'desc',
  status: 'asc',
};

// Matches the "Back to invoices" link: uppercase mono, underline on hover.
const linkStyle = {
  fontSize: 12,
  fontFamily: HEADING,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function fetchInvoices(
  chain: Chain | null,
  statuses: InvoiceStatus[],
  sort: Sort,
  page: number,
  publicId?: string,
): Promise<InvoiceListDto> {
  const { data } = await api.get('/admin/invoices', {
    params: publicId
      ? { publicId, page, limit: LIMIT }
      : {
          ...(chain ? { chain } : {}),
          // Every status selected is the same as no filter.
          ...(statuses.length < STATUSES.length
            ? { status: statuses.join(',') }
            : {}),
          sort: sort.field,
          order: sort.order,
          page,
          limit: LIMIT,
        },
  });
  return data;
}

export default function Invoices() {
  const { enabledChains, multiChain } = useChain();
  const [chainFilter, setChainFilter] = useState<Chain | null>(null);
  const [statuses, setStatuses] = useState<InvoiceStatus[]>(DEFAULT_STATUSES);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);

  const columns: { label: string; sort?: SortField }[] = [
    { label: 'Public ID', sort: 'publicId' },
    ...(multiChain ? [{ label: 'Chain' }] : []),
    { label: 'Amount', sort: 'amount' },
    { label: 'Status', sort: 'status' },
    { label: 'Created', sort: 'createdAt' },
    { label: 'Expires', sort: 'expiresAt' },
    { label: '' },
  ];

  const publicId = UUID_RE.test(search.trim()) ? search.trim() : undefined;
  const searching = search.trim().length > 0;

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', chainFilter, statuses, sort, page, publicId],
    queryFn: () => fetchInvoices(chainFilter, statuses, sort, page, publicId),
    refetchInterval: 60_000,
    enabled: !searching || !!publicId,
  });

  function handleChainFilter(value: string | null) {
    setChainFilter((value as Chain) || null);
    setPage(1);
  }

  if (isLoading) return <PageLoader />;

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;

  function handleStatusFilter(s: InvoiceStatus) {
    setStatuses((prev) => {
      if (!prev.includes(s))
        return STATUSES.filter((x) => x === s || prev.includes(x));
      // Keep at least one selected; an empty filter would just show nothing.
      return prev.length > 1 ? prev.filter((x) => x !== s) : prev;
    });
    setPage(1);
  }

  function handleSort(field: SortField) {
    setSort((prev) =>
      prev.field === field
        ? { field, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : { field, order: FIRST_ORDER[field] },
    );
    setPage(1);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <Stack gap="xl">
      {/* Header */}
      <Group justify="space-between" align="center">
        <Title
          order={2}
          style={{ fontFamily: HEADING, letterSpacing: '-0.02em' }}
        >
          Invoices
        </Title>
        <Button
          component={Link}
          to="/invoices/new"
          leftSection={<IconPlus size={16} />}
          size="xs"
        >
          New Invoice
        </Button>
      </Group>

      <Group gap="sm" align="flex-start">
        <TextInput
          placeholder="Search by Public ID"
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => handleSearchChange(e.currentTarget.value)}
          minLength={36}
          maxLength={36}
          error={searching && !publicId ? 'Invalid Public ID' : undefined}
          styles={{ input: { fontFamily: HEADING, fontSize: 13 } }}
          w={{ base: '100%', md: '50%' }}
        />
        {multiChain && (
          <Select
            placeholder="All chains"
            data={enabledChains.map((c) => ({
              value: c,
              label: c.toUpperCase(),
            }))}
            value={chainFilter}
            onChange={handleChainFilter}
            clearable
            disabled={searching}
            styles={{
              input: { fontFamily: HEADING, fontSize: 13, width: 140 },
            }}
          />
        )}
      </Group>

      {/* Status filters */}
      <Group gap="xs" style={{ opacity: searching ? 0.4 : 1 }}>
        {STATUSES.map((s) => {
          const active = statuses.includes(s);
          const sc = STATUS_COLORS[s];
          return (
            <UnstyledButton
              key={s}
              disabled={searching}
              onClick={() => handleStatusFilter(s)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: HEADING,
                padding: '4px 12px',
                borderRadius: 99,
                border: `1px solid ${active ? sc.border : 'var(--mantine-color-dark-4)'}`,
                color: active ? sc.color : MUTED,
                background: active ? sc.bg : 'transparent',
                transition: 'all 150ms ease',
                cursor: searching ? 'not-allowed' : 'pointer',
              }}
            >
              {s}
            </UnstyledButton>
          );
        })}
      </Group>

      {/* Table */}
      <Paper
        radius="sm"
        style={{
          background: 'var(--mantine-color-dark-7)',
          border: `1px solid var(--mantine-color-dark-5)`,
          overflow: 'hidden',
        }}
      >
        <Table.ScrollContainer minWidth={760} type="native">
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr
                style={{
                  borderBottom: `1px solid var(--mantine-color-dark-5)`,
                }}
              >
                {columns.map((col, i) => {
                  const active = !!col.sort && sort.field === col.sort;
                  const SortIcon = !active
                    ? IconArrowsSort
                    : sort.order === 'asc'
                      ? IconArrowUp
                      : IconArrowDown;
                  return (
                    <Table.Th
                      key={i}
                      aria-sort={
                        active
                          ? sort.order === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: MUTED,
                        fontFamily: HEADING,
                        padding: '12px 16px',
                        borderBottom: 'none',
                      }}
                    >
                      {col.sort && !searching ? (
                        <UnstyledButton
                          onClick={() => handleSort(col.sort!)}
                          style={{
                            font: 'inherit',
                            letterSpacing: 'inherit',
                            textTransform: 'inherit',
                            color: active
                              ? 'var(--mantine-color-dark-0)'
                              : MUTED,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {col.label}
                          <SortIcon
                            size={12}
                            style={{ opacity: active ? 1 : 0.5 }}
                          />
                        </UnstyledButton>
                      ) : (
                        col.label
                      )}
                    </Table.Th>
                  );
                })}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Table.Tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <Table.Td key={j} style={{ padding: '14px 16px' }}>
                        <Skeleton
                          height={12}
                          width={`${60 + (((i + j) * 7) % 30)}%`}
                          radius="sm"
                        />
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))
              ) : data?.data.length === 0 ? (
                <Table.Tr>
                  <Table.Td
                    colSpan={columns.length}
                    style={{ padding: '40px 16px', textAlign: 'center' }}
                  >
                    <Text size="sm" c="dimmed">
                      No invoices found
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                data?.data.map((inv) => (
                  <Table.Tr key={inv.publicId}>
                    <Table.Td style={{ padding: '10px 16px' }}>
                      <Group gap={4} wrap="nowrap">
                        <Text
                          title={inv.publicId}
                          style={{
                            fontFamily: HEADING,
                            fontSize: 12,
                            color: MUTED,
                          }}
                        >
                          {inv.publicId.slice(0, 8)}…
                        </Text>
                        <CopyIcon value={inv.publicId} label="Copy Public ID" />
                      </Group>
                    </Table.Td>
                    {multiChain && (
                      <Table.Td style={{ padding: '14px 16px' }}>
                        <Text
                          style={{
                            fontFamily: HEADING,
                            fontSize: 12,
                            color: MUTED,
                          }}
                        >
                          {inv.chain.toUpperCase()}
                        </Text>
                      </Table.Td>
                    )}
                    <Table.Td style={{ padding: '14px 16px' }}>
                      <Group gap={8}>
                        <Text size="sm" fw={600}>
                          {formatAtomic(
                            inv.amountAtomic,
                            inv.assetDecimals,
                            inv.asset,
                          )}
                        </Text>
                        <Text style={{ fontSize: 11, color: MUTED }}>
                          {inv.amountFiat.toFixed(2)} {inv.fiatCurrency}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td style={{ padding: '14px 16px' }}>
                      <StatusBadge status={inv.status} />
                    </Table.Td>
                    <Table.Td style={{ padding: '14px 16px' }}>
                      <Text
                        style={{
                          fontSize: 12,
                          color: MUTED,
                          fontFamily: HEADING,
                        }}
                      >
                        {formatDate(inv.createdAt)}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ padding: '14px 16px' }}>
                      <Text
                        style={{
                          fontSize: 12,
                          color: MUTED,
                          fontFamily: HEADING,
                        }}
                      >
                        {formatDate(inv.expiresAt)}
                      </Text>
                    </Table.Td>
                    <Table.Td
                      style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}
                    >
                      <Group gap={16} justify="flex-end" wrap="nowrap">
                        <ShareInvoiceIcon publicId={inv.publicId} />
                        <ActionIcon
                          component={Link}
                          to={`/invoices/${inv.publicId}`}
                          variant="subtle"
                          color="gray"
                          size="md"
                          aria-label="Open invoice detail"
                        >
                          <IconExternalLink size={20} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>

      {/* Pagination */}
      <Group justify="space-between">
        <Text style={{ fontSize: 12, color: MUTED, fontFamily: HEADING }}>
          {data ? `${data.total} total` : '—'}
        </Text>
        <Group gap={16}>
          <Anchor
            component="button"
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            underline={page === 1 ? 'never' : 'hover'}
            style={{
              ...linkStyle,
              color: page === 1 ? 'var(--mantine-color-dark-3)' : MUTED,
              cursor: page === 1 ? 'not-allowed' : 'pointer',
            }}
          >
            <IconChevronLeft size={14} />
            Prev
          </Anchor>
          <Text style={{ fontSize: 12, color: MUTED, fontFamily: HEADING }}>
            Page {page} of {totalPages}
          </Text>
          <Anchor
            component="button"
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            underline={page >= totalPages ? 'never' : 'hover'}
            style={{
              ...linkStyle,
              color: page >= totalPages ? 'var(--mantine-color-dark-3)' : MUTED,
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            Next
            <IconChevronRight size={14} />
          </Anchor>
        </Group>
      </Group>
    </Stack>
  );
}
