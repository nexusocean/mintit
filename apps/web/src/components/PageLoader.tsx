import { Center } from '@mantine/core';
import { IconCoinMoneroFilled } from '@tabler/icons-react';
import { PRIMARY } from '@/src/lib/theme';

export function PageLoader() {
  return (
    <Center style={{ minHeight: '100vh' }}>
      <IconCoinMoneroFilled
        className="spin"
        size={64}
        color={PRIMARY}
        aria-label="Loading"
      />
    </Center>
  );
}
