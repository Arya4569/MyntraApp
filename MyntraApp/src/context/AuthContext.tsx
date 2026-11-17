import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { authService } from '@/services/auth-service';
import { pushNotificationService } from '@/services/push-notification-service';
import { storeService } from '@/services/store-service';
import {
  LoginPayload,
  LoginResult,
  RegisterPayload,
  RegisterResult,
  SendOtpResult,
  ThemeMode,
  User,
  VerifyOtpResult,
} from '@/types/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalVisible: boolean;
  isLiveProvider: boolean;
  authError: string | null;
  clearAuthError: () => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  sendOtp: (mobile: string) => Promise<SendOtpResult>;
  verifyOtp: (mobile: string, otp: string) => Promise<VerifyOtpResult>;
  registerUser: (
    mobile: string,
    name: string,
    email?: string,
    gender?: 'Men' | 'Women' | 'Other',
    password?: string
  ) => Promise<RegisterResult>;
  registerWithBackend: (payload: RegisterPayload) => Promise<RegisterResult>;
  loginWithBackend: (payload: LoginPayload) => Promise<LoginResult>;
  resetPassword: (
    identifier: string,
    otp: string,
    newPassword: string
  ) => Promise<LoginResult>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<boolean>;
  updateThemePreference: (theme: ThemeMode) => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalVisible, setIsAuthModalVisible] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Check if live SMS provider is configured
  const isLiveProvider = Boolean(
    process.env.EXPO_PUBLIC_SUPABASE_URL &&
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  );

  // Clear any active auth error banner
  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  // Restore authenticated session on app startup
  useEffect(() => {
    let isMounted = true;
    const restoreSession = async () => {
      try {
        await authService.initializeRegistry();
        // Check stored session first
        const sessionUser = await authService.getSession();
        const sessionToken = await authService.getToken();

        // If the stored session is the dev demo user ('usr-demo-1'), clean it up so the web opens clean as guest
        if (sessionUser?.id === 'usr-demo-1') {
          await authService.clearSession();
          if (isMounted) {
            setUser(null);
            setToken(null);
            setIsLoading(false);
          }
          return;
        }

        // Real user session with active token: verify with backend
        if (sessionUser && sessionToken) {
          const freshUser = await authService.fetchMe();
          if (freshUser && isMounted) {
            setUser(freshUser);
            setToken(sessionToken);
          } else if (isMounted) {
            // Token rejected (expired or invalid) -> safely reset to unauthenticated guest
            await authService.clearSession();
            setUser(null);
            setToken(null);
          }
        } else if (isMounted) {
          // No active valid token -> start as clean unauthenticated guest
          await authService.clearSession();
          setUser(null);
          setToken(null);
        }
      } catch (e) {
        console.warn('Failed to restore auth session:', e);
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const openAuthModal = useCallback(() => {
    setAuthError(null);
    setIsAuthModalVisible(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthError(null);
    setIsAuthModalVisible(false);
  }, []);

  const sendOtp = useCallback(async (mobile: string): Promise<SendOtpResult> => {
    return await authService.sendOtp(mobile);
  }, []);

  const verifyOtp = useCallback(
    async (mobile: string, otp: string): Promise<VerifyOtpResult> => {
      const result = await authService.verifyOtp(mobile, otp);
      if (result.success && result.user) {
        setUser(result.user);
        const storedToken = await authService.getToken();
        setToken(storedToken);
        setIsAuthModalVisible(false);
      }
      return result;
    },
    []
  );

  const registerUser = useCallback(
    async (
      mobile: string,
      name: string,
      email?: string,
      gender?: 'Men' | 'Women' | 'Other',
      password?: string
    ): Promise<RegisterResult> => {
      const result = await authService.registerUser(
        mobile,
        name,
        email,
        gender,
        password
      );
      if (result.success && result.user) {
        setUser(result.user);
        const storedToken = await authService.getToken();
        setToken(storedToken);
        setIsAuthModalVisible(false);
      }
      return result;
    },
    []
  );

  const registerWithBackend = useCallback(
    async (payload: RegisterPayload): Promise<RegisterResult> => {
      setAuthError(null);
      const result = await authService.registerWithBackend(payload);
      if (result.success && result.user) {
        setUser(result.user);
        setToken(result.token || null);
        setIsAuthModalVisible(false);
      } else if (result.error) {
        setAuthError(result.error);
      }
      return result;
    },
    []
  );

  const loginWithBackend = useCallback(
    async (payload: LoginPayload): Promise<LoginResult> => {
      setAuthError(null);
      const result = await authService.loginWithBackend(payload);
      if (result.success && result.user) {
        setUser(result.user);
        setToken(result.token || null);
        setIsAuthModalVisible(false);
      } else if (result.error) {
        setAuthError(result.error);
      }
      return result;
    },
    []
  );

  const resetPassword = useCallback(
    async (
      identifier: string,
      otp: string,
      newPassword: string
    ): Promise<LoginResult> => {
      setAuthError(null);
      const result = await authService.resetPassword(
        identifier,
        otp,
        newPassword
      );
      if (result.success && result.user) {
        setUser(result.user);
        setToken(result.token || null);
        setIsAuthModalVisible(false);
      } else if (result.error) {
        setAuthError(result.error);
      }
      return result;
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      const currentUserId = user?.id;
      // 1. Unregister and clear push token from device and backend
      const storedToken = await pushNotificationService.getStoredPushToken();
      if (storedToken) {
        await storeService.unregisterDeviceToken(storedToken);
      }
      await pushNotificationService.clearStoredPushToken();

      // 2. Clear delivered account notifications from tray and cancel account reminders
      await pushNotificationService.clearDeliveredNotifications();
      await pushNotificationService.cancelAccountScheduledNotifications();

      // 3. Clear user local cache (orders, cart, wishlist, addresses, etc.) and session
      await storeService.clearAccountLocalCache(currentUserId);
      await authService.clearSession();
    } catch (e) {
      console.warn('Error during logout cleanup:', e);
    } finally {
      setUser(null);
      setToken(null);
    }
  }, [user]);

  const updateUser = useCallback(
    async (updates: Partial<User>): Promise<boolean> => {
      if (!user) return false;
      const updated = await authService.updateProfile(user.id, updates);
      if (updated) {
        setUser(updated);
        return true;
      }
      return false;
    },
    [user]
  );

  const updateThemePreference = useCallback(
    async (themeMode: ThemeMode): Promise<boolean> => {
      const success = await authService.updatePreferences({
        themePreference: themeMode,
      });
      if (success) {
        setUser((prev) =>
          prev ? { ...prev, themePreference: themeMode } : null
        );
      }
      return success;
    },
    []
  );

  const refreshUser = useCallback(async (): Promise<void> => {
    const updated = await authService.fetchMe();
    if (updated) {
      setUser(updated);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: user !== null,
        isLoading,
        isAuthModalVisible,
        isLiveProvider,
        authError,
        clearAuthError,
        openAuthModal,
        closeAuthModal,
        sendOtp,
        verifyOtp,
        registerUser,
        registerWithBackend,
        loginWithBackend,
        resetPassword,
        logout,
        updateUser,
        updateThemePreference,
        refreshUser,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
