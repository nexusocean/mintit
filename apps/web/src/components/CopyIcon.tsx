import { ActionIcon, CopyButton, Tooltip } from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';

/** Small copy-to-clipboard icon; turns into a check for a moment once copied. */
export function CopyIcon({
  value,
  label = 'Copy',
  size = 14,
}: {
  value: string;
  label?: string;
  size?: number;
}) {
  return (
    <CopyButton value={value} timeout={2000}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? 'Copied' : label} withArrow>
          <ActionIcon
            color={copied ? 'teal' : 'gray'}
            variant="subtle"
            size="sm"
            onClick={copy}
            aria-label={label}
          >
            {copied ? <IconCheck size={size} /> : <IconCopy size={size} />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );
}
