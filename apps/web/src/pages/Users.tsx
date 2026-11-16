import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconLink, IconPlus, IconTrash } from '@tabler/icons-react';
import { UserScope } from '@mintit/types';
import { api } from '@/src/lib/api';
import { useSession } from '@/src/lib/session';
import { apiErrorMessage } from '@/src/lib/errors';
import { formatDate } from '@/src/utils';
import { HEADING, MUTED } from '@/src/lib/theme';
import { CopyField } from '@/src/components/TotpSetupModal';
import { PageLoader } from '@/src/components/PageLoader';

interface UserRow {
  id: string;
  email: string;
  role: UserScope;
  status: 'active' | 'pending';
  createdAt: string;
}

interface InviteResult {
  user: UserRow;
  token: string;
  expiresAt: string;
}

const ROLE_OPTIONS = [
  { value: UserScope.MANAGER, label: 'Manager' },
  { value: UserScope.ADMIN, label: 'Admin' },
];

const ROLE_HELP =
  'Managers can view and create invoices. Admins can also see the wallet, ' +
  'change settings and manage users.';

const usersKey = ['admin', 'users'] as const;

// The token goes in the fragment, which browsers never send to the server,
// so it stays out of access logs.
const inviteLink = (token: string) =>
  `${window.location.origin}/invite#${token}`;

const cellStyle = { padding: '14px 16px' };
const headStyle = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: MUTED,
  fontFamily: HEADING,
  padding: '12px 16px',
  borderBottom: 'none',
};

function InviteModal({
  opened,
  onClose,
  onInvited,
}: {
  opened: boolean;
  onClose: () => void;
  onInvited: (result: InviteResult) => void;
}) {
  const form = useForm({
    initialValues: { email: '', role: UserScope.MANAGER as string },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Invalid email'),
    },
  });

  const invite = useMutation({
    mutationFn: (values: typeof form.values) =>
      api.post<InviteResult>('/admin/users', values).then((r) => r.data),
    onSuccess: (result) => {
      form.reset();
      onInvited(result);
    },
  });

  const close = () => {
    invite.reset();
    onClose();
  };

  return (
    <Modal opened={opened} onClose={close} title="Invite user" centered>
      <form onSubmit={form.onSubmit((v) => invite.mutate(v))}>
        <Stack gap="md">
          {invite.isError && (
            <Alert color="red" radius="sm" p="sm">
              {apiErrorMessage(invite.error, 'Could not invite user')}
            </Alert>
          )}
          <TextInput
            type="email"
            label="Email"
            placeholder="staff@example.com"
            {...form.getInputProps('email')}
          />
          <Select
            label="Role"
            data={ROLE_OPTIONS}
            allowDeselect={false}
            description={ROLE_HELP}
            {...form.getInputProps('role')}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={invite.isPending}>
              Create invite link
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function InviteLinkModal({
  invite,
  onClose,
}: {
  invite: InviteResult | null;
  onClose: () => void;
}) {
  return (
    <Modal
      opened={!!invite}
      onClose={onClose}
      title="Invite link"
      centered
      size="lg"
    >
      {invite && (
        <Stack gap="md">
          <Text size="sm">
            Send this link to <b>{invite.user.email}</b>. They choose a password
            and set up 2FA to join.
          </Text>
          <CopyField label="Link" value={inviteLink(invite.token)} />
          <Text size="xs" c="dimmed">
            It works once and expires {formatDate(invite.expiresAt)}. It
            won&apos;t be shown again; create a new one from the user list if
            it&apos;s lost.
          </Text>
          <Group justify="flex-end">
            <Button onClick={onClose}>Done</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

function RemoveModal({
  user,
  onClose,
}: {
  user: UserRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKey });
      onClose();
    },
  });

  const close = () => {
    remove.reset();
    onClose();
  };

  return (
    <Modal opened={!!user} onClose={close} title="Remove user" centered>
      {user && (
        <Stack gap="md">
          {remove.isError && (
            <Alert color="red" radius="sm" p="sm">
              {apiErrorMessage(remove.error, 'Could not remove user')}
            </Alert>
          )}
          <Text size="sm">
            Remove <b>{user.email}</b>? They&apos;re signed out right away and
            can&apos;t sign back in.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={close}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={remove.isPending}
              onClick={() => remove.mutate(user.id)}
            >
              Remove
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

export default function Users() {
  const queryClient = useQueryClient();
  const { data: me } = useSession();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [link, setLink] = useState<InviteResult | null>(null);
  const [removing, setRemoving] = useState<UserRow | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: usersKey,
    queryFn: () => api.get<UserRow[]>('/admin/users').then((r) => r.data),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: usersKey });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserScope }) =>
      api.patch(`/admin/users/${id}`, { role }),
    onSettled: refresh,
  });

  const reissue = useMutation({
    mutationFn: (id: string) =>
      api.post<InviteResult>(`/admin/users/${id}/invite`).then((r) => r.data),
    onSuccess: setLink,
  });

  if (isLoading) return <PageLoader />;

  const actionError = changeRole.error ?? reissue.error;

  return (
    <Stack gap="xl">
      <InviteModal
        opened={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={(result) => {
          setInviteOpen(false);
          setLink(result);
          refresh();
        }}
      />
      <InviteLinkModal invite={link} onClose={() => setLink(null)} />
      <RemoveModal user={removing} onClose={() => setRemoving(null)} />

      <Group justify="space-between" align="center">
        <Title
          order={2}
          style={{ fontFamily: HEADING, letterSpacing: '-0.02em' }}
        >
          Users
        </Title>
        <Button
          leftSection={<IconPlus size={16} />}
          size="xs"
          onClick={() => setInviteOpen(true)}
        >
          Invite user
        </Button>
      </Group>

      <Text size="sm" c="dimmed">
        {ROLE_HELP}
      </Text>

      {actionError && (
        <Alert
          color="red"
          radius="sm"
          p="sm"
          withCloseButton
          onClose={() => {
            changeRole.reset();
            reissue.reset();
          }}
        >
          {apiErrorMessage(actionError, 'Something went wrong')}
        </Alert>
      )}

      <Paper
        radius="sm"
        style={{
          background: 'var(--mantine-color-dark-7)',
          border: `1px solid var(--mantine-color-dark-5)`,
          overflow: 'hidden',
        }}
      >
        <Table.ScrollContainer minWidth={640} type="native">
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                {['Email', 'Role', 'Status', 'Added', ''].map((h, i) => (
                  <Table.Th key={i} style={headStyle}>
                    {h}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users?.map((user) => {
                const isMe = user.email === me?.email;
                return (
                  <Table.Tr key={user.id}>
                    <Table.Td style={cellStyle}>
                      <Group gap={8} wrap="nowrap">
                        <Text size="sm">{user.email}</Text>
                        {isMe && (
                          <Badge size="xs" variant="outline" color="gray">
                            You
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td style={cellStyle}>
                      <Select
                        data={ROLE_OPTIONS}
                        value={user.role}
                        allowDeselect={false}
                        disabled={isMe || changeRole.isPending}
                        onChange={(role) =>
                          role &&
                          role !== user.role &&
                          changeRole.mutate({
                            id: user.id,
                            role: role as UserScope,
                          })
                        }
                        size="xs"
                        w={130}
                        aria-label={`Role for ${user.email}`}
                      />
                    </Table.Td>
                    <Table.Td style={cellStyle}>
                      <Badge
                        size="sm"
                        variant="light"
                        color={user.status === 'active' ? 'teal' : 'yellow'}
                      >
                        {user.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={cellStyle}>
                      <Text
                        style={{
                          fontSize: 12,
                          color: MUTED,
                          fontFamily: HEADING,
                        }}
                      >
                        {formatDate(user.createdAt)}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                      <Group gap={8} justify="flex-end" wrap="nowrap">
                        {user.status === 'pending' && (
                          <Tooltip label="New invite link">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              loading={
                                reissue.isPending &&
                                reissue.variables === user.id
                              }
                              onClick={() => reissue.mutate(user.id)}
                              aria-label={`New invite link for ${user.email}`}
                            >
                              <IconLink size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {!isMe && (
                          <Tooltip label="Remove">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => setRemoving(user)}
                              aria-label={`Remove ${user.email}`}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </Stack>
  );
}
