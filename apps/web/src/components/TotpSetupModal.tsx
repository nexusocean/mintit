import {
  ActionIcon,
  Alert,
  Box,
  Button,
  CopyButton,
  Divider,
  Group,
  Modal,
  PinInput,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { CARD_BORDER, HEADING, PRIMARY, TEXT } from '@/src/lib/theme';

export interface TotpSetupData {
  qrCode: string;
  secret: string;
  backupCodes: string[];
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text size="xs" c="dimmed" mb={4}>
        {label}
      </Text>
      <Group gap={8} align="center">
        <Text
          size="sm"
          style={{
            fontFamily: HEADING,
            background: '#080a0d',
            padding: '6px 10px',
            borderRadius: 4,
            border: `1px solid ${CARD_BORDER}`,
            flex: 1,
            wordBreak: 'break-all',
          }}
        >
          {value}
        </Text>
        <CopyButton value={value} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied' : 'Copy'} position="right">
              <ActionIcon
                color={copied ? 'teal' : 'gray'}
                variant="subtle"
                onClick={copy}
              >
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
    </Box>
  );
}

interface TotpSetupModalProps {
  opened: boolean;
  data: TotpSetupData | null;
  token: string;
  onTokenChange: (token: string) => void;
  // Receives the code from PinInput's onComplete, which can arrive before the
  // token state has updated.
  onConfirm: (token?: string) => void;
  error: string | null;
  loading: boolean;
  confirmLabel: string;
  // When set, the modal can be dismissed (e.g. a reset, where the old secret
  // still works). Without it the user must finish setup.
  onCancel?: () => void;
}

export function TotpSetupModal({
  opened,
  data,
  token,
  onTokenChange,
  onConfirm,
  error,
  loading,
  confirmLabel,
  onCancel,
}: TotpSetupModalProps) {
  const dismissable = Boolean(onCancel);

  return (
    <Modal
      opened={opened}
      onClose={onCancel ?? (() => {})}
      withCloseButton={dismissable}
      // Only the close button dismisses it, so a stray click or keypress
      // can't lose the codes before they're saved.
      closeOnClickOutside={false}
      closeOnEscape={false}
      title={
        <Text style={{ color: TEXT, fontFamily: HEADING, fontWeight: 700 }}>
          Set up two-factor authentication
        </Text>
      }
      size="md"
      radius="sm"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Scan the QR code with your authenticator app, or enter the secret
          manually. Save your backup codes somewhere safe — they cannot be
          recovered.
        </Text>

        {Array.isArray(data?.backupCodes) && (
          <>
            <Box style={{ display: 'flex', justifyContent: 'center' }}>
              <img
                src={data.qrCode}
                alt="Authenticator QR code"
                style={{ width: 180, height: 180, borderRadius: 8 }}
              />
            </Box>

            <CopyField label="Secret key" value={data.secret} />

            <Divider />

            <Box>
              <Text size="xs" c="dimmed" mb={6}>
                Backup codes — store these securely
              </Text>
              <ScrollArea h={160}>
                <Box
                  style={{
                    background: '#080a0d',
                    border: `1px solid ${CARD_BORDER}`,
                    borderRadius: 4,
                    padding: '12px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 4,
                  }}
                >
                  {data.backupCodes.map((code) => (
                    <Text
                      key={code}
                      size="sm"
                      style={{ fontFamily: HEADING, color: PRIMARY }}
                    >
                      {code}
                    </Text>
                  ))}
                </Box>
              </ScrollArea>
              <CopyButton value={data.backupCodes.join('\n')} timeout={2000}>
                {({ copied, copy }) => (
                  <Button
                    variant="subtle"
                    size="xs"
                    mt={6}
                    leftSection={
                      copied ? <IconCheck size={12} /> : <IconCopy size={12} />
                    }
                    onClick={copy}
                    color={copied ? 'teal' : 'gray'}
                  >
                    {copied ? 'Copied' : 'Copy all backup codes'}
                  </Button>
                )}
              </CopyButton>
            </Box>

            <Divider />

            {error && (
              <Alert color="red" radius="sm" p="sm">
                {error}
              </Alert>
            )}

            <Box>
              <Text size="sm" mb={8}>
                Enter the 6-digit code from your authenticator app to confirm
                setup
              </Text>
              <Group justify="center" mb="md">
                <PinInput
                  length={6}
                  type="number"
                  value={token}
                  onChange={onTokenChange}
                  onComplete={onConfirm}
                />
              </Group>
              <Button
                fullWidth
                color="brand"
                loading={loading}
                onClick={() => onConfirm()}
                disabled={token.length !== 6}
                style={{ fontFamily: HEADING }}
              >
                {confirmLabel}
              </Button>
            </Box>
          </>
        )}
      </Stack>
    </Modal>
  );
}
