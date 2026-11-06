import {
  Button,
  createTheme,
  Input,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core';
import { InvoiceStatus } from '@mintit/types';

const brand: MantineColorsTuple = [
  '#fff4ec', // [0]
  '#ffe6d5', // [1]
  '#ffcca8', // [2]
  '#ffad75', // [3]
  '#ff8a40', // [4]
  '#ff6600', // [5] Monero orange (primary accent)
  '#e65c00', // [6]
  '#cc5200', // [7]
  '#a34100', // [8]
  '#7a3100', // [9]
];

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 5, dark: 5 },
  defaultRadius: 'sm',
  fontFamily: 'var(--font-space-grotesk), sans-serif',
  headings: {
    fontFamily: 'var(--font-space-mono), monospace',
    fontWeight: '700',
  },
  fontSizes: {
    xs: '14px',
    sm: '16px',
    md: '18px',
    lg: '20px',
    xl: '22px',
  },

  colors: {
    brand,
    dark: [
      '#f5f5f5', // [0] text primary
      '#d0d0d0', // [1] text muted
      '#9a9a9a', // [2] text dimmed
      '#6e6e6e', // [3] border active
      '#4c4c4c', // [4] border default (Monero gray)
      '#383838', // [5] surface hover
      '#2b2b2b', // [6] surface / nav active bg
      '#1f1f1f', // [7] card bg
      '#161616', // [8] page background
      '#0d0d0d', // [9] deepest bg
    ],
  },

  components: {
    Button: Button.extend({
      defaultProps: { variant: 'outline' },
      vars: () => ({
        root: {
          '--button-color': '#ff6600',
          '--button-bd': '1.5px solid #ff6600',
          '--button-bg': 'transparent',
          '--button-hover': '#ff6600',
          '--button-hover-color': '#0d0d0d',
        },
      }),
    }),

    Input: Input.extend({
      vars: () => ({
        wrapper: {
          '--input-height': '36px',
        },
      }),
      styles: () => ({
        input: {
          backgroundColor: 'transparent',
          border: '1px solid #ff660040',
          color: '#f5f5f5',
          '&::placeholder': {
            color: '#9a9a9a',
          },
        },
      }),
    }),
  },
});

export const cssVariablesResolver: CSSVariablesResolver = (_theme) => {
  const shared = {
    '--mantine-color-body': '#161616',
    '--mantine-color-default': '#1f1f1f',
    '--mantine-color-default-border': '#383838',
    '--mantine-color-dimmed': '#9a9a9a',
  };
  return {
    variables: {},
    light: shared,
    dark: shared,
  };
};

export const PRIMARY = '#ff6600';
export const BG = '#161616';
export const SURFACE = '#1f1f1f';
export const CARD = '#1f1f1f';
export const CARD_BORDER = '#ff660020';
export const CARD_BORDER_HOVER = '#ff660045';
export const BORDER = '#383838';
export const TEXT = '#f5f5f5';
export const MUTED = '#9a9a9a';
export const HEADING = 'var(--font-space-mono), monospace';
export const SANS = 'var(--font-space-grotesk), sans-serif';

const SUCCESS = '#4ade80';

export const STATUS_COLORS: Record<
  InvoiceStatus,
  { color: string; bg: string; border: string }
> = {
  pending: {
    color: 'var(--mantine-color-dark-1)',
    bg: 'var(--mantine-color-dark-5)',
    border: 'var(--mantine-color-dark-4)',
  },
  seen: {
    color: '#93c5fd',
    bg: 'rgba(96,165,250,0.1)',
    border: 'rgba(96,165,250,0.25)',
  },
  confirmed: {
    color: SUCCESS,
    bg: 'rgba(74,222,128,0.1)',
    border: 'rgba(74,222,128,0.25)',
  },
  underpaid: {
    color: '#fcd34d',
    bg: 'rgba(251,191,36,0.1)',
    border: 'rgba(251,191,36,0.25)',
  },
  expired: {
    color: 'var(--mantine-color-dark-2)',
    bg: 'var(--mantine-color-dark-6)',
    border: 'var(--mantine-color-dark-4)',
  },
  cancelled: {
    color: '#f87171',
    bg: 'rgba(248,113,113,0.1)',
    border: 'rgba(248,113,113,0.25)',
  },
};
