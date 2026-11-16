import { BorderRadius, Colors, Spacing as BaseSpacing, ThemeTokens } from './theme';

export { BorderRadius, Colors } from './theme';
export type { ResolvedTheme, ThemeColor, ThemeMode, ThemeTokens } from './theme';

export const MyntraColors = Colors.light;

export const Spacing = {
  ...BaseSpacing,
};
