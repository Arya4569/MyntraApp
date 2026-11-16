/**
 * Centralized Design System & Theme Configuration
 * Supports Light Mode and Dark Mode with dynamic switching,
 * extendable token architecture, and full backward compatibility.
 */

import '@/global.css';

import { Platform } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeTokens {
  // Core text tokens
  text: string;
  textSecondary: string;
  textMuted: string;

  // Core surface & background tokens
  background: string;
  backgroundElement: string;
  backgroundSelected: string;
  surface: string;
  surfaceSecondary: string;
  surfaceElevated: string;

  // Borders & dividers
  border: string;
  cardBorder: string;
  divider: string;

  // Form inputs & controls
  inputBackground: string;
  placeholder: string;
  modalOverlay: string;

  // Myntra brand tokens
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryGradientStart: string;
  primaryGradientEnd: string;
  accent: string;
  ratingGreen: string;
  discountOrange: string;
  saleYellow: string;
  saleDark: string;
  badgeRed: string;

  // Neutral utility tokens
  white: string;
  black: string;
  shadowColor: string;

  // Status bar & theme flag
  statusBarStyle: 'dark-content' | 'light-content';
  isDark: boolean;
}

export const Colors: Record<ResolvedTheme, ThemeTokens> = {
  light: {
    // Core text tokens
    text: '#282c3f',
    textSecondary: '#535766',
    textMuted: '#94969f',

    // Core surface & background tokens
    background: '#f5f5f6',
    backgroundElement: '#f0f0f3',
    backgroundSelected: '#e0e1e6',
    surface: '#ffffff',
    surfaceSecondary: '#f5f5f6',
    surfaceElevated: '#ffffff',

    // Borders & dividers
    border: '#e6e6e8',
    cardBorder: '#ededef',
    divider: '#eaeaec',

    // Form inputs & controls
    inputBackground: '#f5f5f6',
    placeholder: '#94969f',
    modalOverlay: 'rgba(0, 0, 0, 0.5)',

    // Myntra brand tokens
    primary: '#ff3f6c',
    primaryDark: '#d91b4c',
    primaryLight: '#fff0f3',
    primaryGradientStart: '#ff3f6c',
    primaryGradientEnd: '#ff527b',
    accent: '#f26a10',
    ratingGreen: '#03a685',
    discountOrange: '#ff905a',
    saleYellow: '#ffdf00',
    saleDark: '#1d1d2c',
    badgeRed: '#ff3f6c',

    // Neutral utility tokens
    white: '#ffffff',
    black: '#000000',
    shadowColor: '#000000',

    // Status bar & theme flag
    statusBarStyle: 'dark-content',
    isDark: false,
  },
  dark: {
    // Core text tokens (OLED high contrast)
    text: '#f3f4f6',
    textSecondary: '#a0a3b1',
    textMuted: '#717483',

    // Core surface & background tokens (Rich dark tones)
    background: '#121214',
    backgroundElement: '#212226',
    backgroundSelected: '#2e3137',
    surface: '#1c1d22',
    surfaceSecondary: '#25272e',
    surfaceElevated: '#282a32',

    // Borders & dividers
    border: '#2e3039',
    cardBorder: '#2c2e36',
    divider: '#282a31',

    // Form inputs & controls
    inputBackground: '#24262d',
    placeholder: '#6e7180',
    modalOverlay: 'rgba(0, 0, 0, 0.75)',

    // Myntra brand tokens (Vibrant on dark surfaces)
    primary: '#ff3f6c',
    primaryDark: '#ff527b',
    primaryLight: '#341520',
    primaryGradientStart: '#ff3f6c',
    primaryGradientEnd: '#ff527b',
    accent: '#f26a10',
    ratingGreen: '#03a685',
    discountOrange: '#ff905a',
    saleYellow: '#ffdf00',
    saleDark: '#292938',
    badgeRed: '#ff3f6c',

    // Neutral utility tokens
    white: '#ffffff',
    black: '#000000',
    shadowColor: '#000000',

    // Status bar & theme flag
    statusBarStyle: 'light-content',
    isDark: true,
  },
};

export type ThemeColor =
  | 'text'
  | 'textSecondary'
  | 'textMuted'
  | 'background'
  | 'backgroundElement'
  | 'backgroundSelected'
  | 'surface'
  | 'surfaceSecondary'
  | 'surfaceElevated'
  | 'cardBorder'
  | 'divider'
  | 'inputBackground'
  | 'primary'
  | 'primaryDark'
  | 'primaryLight'
  | 'accent';

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  none: 0,
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const BorderRadius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  round: 9999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Returns complete theme tokens for a resolved mode
 */
export function getTheme(mode: ResolvedTheme = 'light'): ThemeTokens {
  return Colors[mode];
}
