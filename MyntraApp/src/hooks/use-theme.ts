import { useContext } from 'react';
import { useColorScheme } from 'react-native';

import {
  Colors,
  ResolvedTheme,
  ThemeMode,
  ThemeTokens,
} from '@/constants/theme';
import { ThemeContext } from '@/context/ThemeContext';

export interface UseThemeReturn extends ThemeTokens {
  colors: ThemeTokens;
  isDark: boolean;
  themeMode: ThemeMode;
  activeTheme: ResolvedTheme;
  systemScheme: ResolvedTheme;
  isLoadingTheme: boolean;
  setThemeMode: (mode: ThemeMode, syncBackend?: boolean) => Promise<void>;
}

export function useTheme(): UseThemeReturn {
  const context = useContext(ThemeContext);
  const scheme = useColorScheme();

  if (context) {
    return {
      ...context.colors,
      colors: context.colors,
      isDark: context.isDark,
      themeMode: context.themeMode,
      activeTheme: context.activeTheme,
      systemScheme: context.systemScheme,
      isLoadingTheme: context.isLoadingTheme,
      setThemeMode: context.setThemeMode,
    };
  }

  // Fallback if rendered outside ThemeProvider (e.g., isolated test environments)
  const activeTheme: ResolvedTheme = scheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[activeTheme];

  return {
    ...colors,
    colors,
    isDark: activeTheme === 'dark',
    themeMode: 'system',
    activeTheme,
    systemScheme: activeTheme,
    isLoadingTheme: false,
    setThemeMode: async () => {},
  };
}
