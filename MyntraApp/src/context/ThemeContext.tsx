import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';

import {
  Colors,
  ResolvedTheme,
  ThemeMode,
  ThemeTokens,
} from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/auth-service';

const THEME_STORAGE_KEY = '@myntra_theme_mode';

export interface ThemeContextType {
  themeMode: ThemeMode; // 'system' | 'light' | 'dark'
  activeTheme: ResolvedTheme; // 'light' | 'dark'
  isDark: boolean;
  colors: ThemeTokens;
  systemScheme: ResolvedTheme;
  isLoadingTheme: boolean;
  setThemeMode: (mode: ThemeMode, syncBackend?: boolean) => Promise<void>;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, isAuthenticated } = useAuth();
  const rawSystemScheme = useColorScheme();

  // Normalized system scheme ('light' or 'dark')
  const systemScheme: ResolvedTheme = useMemo(() => {
    return rawSystemScheme === 'dark' ? 'dark' : 'light';
  }, [rawSystemScheme]);

  // Selected mode: 'system' | 'light' | 'dark'
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoadingTheme, setIsLoadingTheme] = useState<boolean>(true);

  // Keep a ref to previous authenticated user id to detect login and logout
  const prevUserIdRef = useRef<string | null>(null);

  // 1. Resolve effective theme ('light' or 'dark')
  const activeTheme: ResolvedTheme = useMemo(() => {
    if (themeMode === 'light') return 'light';
    if (themeMode === 'dark') return 'dark';
    return systemScheme;
  }, [themeMode, systemScheme]);

  const isDark = activeTheme === 'dark';
  const colors: ThemeTokens = useMemo(() => Colors[activeTheme], [activeTheme]);

  // 2. Restore saved theme preference from local AsyncStorage on startup
  useEffect(() => {
    let isMounted = true;

    const restoreSavedTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (
          saved &&
          (saved === 'system' || saved === 'light' || saved === 'dark')
        ) {
          if (isMounted) {
            setThemeModeState(saved as ThemeMode);
          }
        } else {
          // Default to system detection
          if (isMounted) {
            setThemeModeState('system');
          }
        }
      } catch (err) {
        console.warn('Failed to load local theme preference:', err);
        if (isMounted) {
          setThemeModeState('system');
        }
      } finally {
        if (isMounted) {
          setIsLoadingTheme(false);
        }
      }
    };

    restoreSavedTheme();

    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Listen to native OS system appearance changes dynamically
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      // Force re-render if in system mode
      if (themeMode === 'system') {
        // State will react to rawSystemScheme or listener
      }
    });

    return () => {
      subscription.remove();
    };
  }, [themeMode]);

  // 4. Update Theme Mode function (Immediate live change + local storage + optional backend sync)
  const setThemeMode = useCallback(
    async (newMode: ThemeMode, syncBackend: boolean = true) => {
      // Validate input
      const validModes: ThemeMode[] = ['system', 'light', 'dark'];
      const targetMode: ThemeMode = validModes.includes(newMode)
        ? newMode
        : 'system';

      // Live update immediately (zero lag, no restart required)
      setThemeModeState(targetMode);

      // Persist to local AsyncStorage
      try {
        await AsyncStorage.setItem(THEME_STORAGE_KEY, targetMode);
      } catch (err) {
        console.warn('Failed to persist theme preference to AsyncStorage:', err);
      }

      // Backend Synchronization: sync preference if user is authenticated
      if (syncBackend && isAuthenticated && user) {
        try {
          authService
            .updatePreferences({ themePreference: targetMode })
            .catch((err) => {
              console.warn(
                'Background backend theme sync failed (offline or network):',
                err
              );
            });
        } catch (e) {
          console.warn('Error initiating backend theme sync:', e);
        }
      }
    },
    [isAuthenticated, user]
  );

  // 5. User Authentication Synchronization (Login & Logout handling)
  useEffect(() => {
    const currentUserId = user?.id || null;
    const prevUserId = prevUserIdRef.current;

    // Detect user login or account switch
    if (currentUserId && currentUserId !== prevUserId) {
      prevUserIdRef.current = currentUserId;

      if (user?.themePreference) {
        // Rule: If user has a saved account theme preference on backend, synchronize local state to match it
        const accountTheme = user.themePreference;
        if (
          (accountTheme === 'light' ||
            accountTheme === 'dark' ||
            accountTheme === 'system') &&
          accountTheme !== themeMode
        ) {
          queueMicrotask(() => {
            setThemeModeState(accountTheme);
          });
          AsyncStorage.setItem(THEME_STORAGE_KEY, accountTheme).catch(() => {});
        }
      } else if (themeMode !== 'system') {
        // If user account didn't have preference set but local user chose one, sync current local choice to newly logged-in account
        authService
          .updatePreferences({ themePreference: themeMode })
          .catch(() => {});
      }
    }

    // Detect user logout: prevent theme leaking into another user's session
    if (!currentUserId && prevUserId) {
      prevUserIdRef.current = null;
      // Reset back to clean 'system' default
      queueMicrotask(() => {
        setThemeModeState('system');
      });
      AsyncStorage.setItem(THEME_STORAGE_KEY, 'system').catch(() => {});
    }
  }, [user, themeMode]);

  const contextValue = useMemo(
    () => ({
      themeMode,
      activeTheme,
      isDark,
      colors,
      systemScheme,
      isLoadingTheme,
      setThemeMode,
    }),
    [
      themeMode,
      activeTheme,
      isDark,
      colors,
      systemScheme,
      isLoadingTheme,
      setThemeMode,
    ]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};
