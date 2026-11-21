import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  AuthSession,
  LoginPayload,
  LoginResult,
  RegisterPayload,
  RegisterResult,
  SendOtpResult,
  User,
  UserPreferences,
  VerifyOtpResult,
} from '@/types/auth';

const STORAGE_KEYS = {
  SESSION: '@myntra_auth_session',
  USERS_REGISTRY: '@myntra_users_registry',
};

// Initial pre-registered user for testing
const INITIAL_DEMO_USERS: Record<string, User> = {
  '9876543210': {
    id: 'usr-demo-1',
    name: 'Aryak Sharma',
    fullName: 'Aryak Sharma',
    mobile: '9876543210',
    mobileNumber: '9876543210',
    email: 'aryak@fashion.dev',
    gender: 'Men',
    createdAt: '2025-08-15T10:00:00.000Z',
    insiderPoints: 240,
  },
};

// In-memory active OTP cache with expiration & rate limiting
interface ActiveOtp {
  mobile: string;
  code: string;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
}

const activeOtps = new Map<string, ActiveOtp>();

const LIVE_BACKEND_URL = 'https://myntra-api-oytt.onrender.com/api';

const getApiBaseUrl = (): string => {
  // 1. If explicit production API URL is baked, use it
  if (process.env.EXPO_PUBLIC_API_URL && !process.env.EXPO_PUBLIC_API_URL.includes('localhost')) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. If running on web in hosted domain (e.g. github.io), route to live HTTPS backend
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.location &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return LIVE_BACKEND_URL;
  }

  // 3. If running on native mobile (APK / standalone phone)
  if (Platform.OS !== 'web') {
    if (__DEV__) {
      const hostUri = Constants.expoConfig?.hostUri;
      if (hostUri) {
        const host = hostUri.split(':')[0];
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
          return `http://${host}:5000/api`;
        }
      }
    }
    // Real Android phone or Standalone APK -> ALWAYS use live HTTPS cloud backend
    return LIVE_BACKEND_URL;
  }

  return 'http://localhost:5000/api';
};

class AuthService {
  /**
   * Initializes users registry if not already saved
   */
  async initializeRegistry(): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.USERS_REGISTRY);
      if (!existing) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.USERS_REGISTRY,
          JSON.stringify(INITIAL_DEMO_USERS)
        );
      }
    } catch (e) {
      console.warn('Failed to initialize users registry:', e);
    }
  }

  /**
   * Fetch all registered users from local cache
   */
  private async getUsersRegistry(): Promise<Record<string, User>> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.USERS_REGISTRY);
      if (!json) return INITIAL_DEMO_USERS;
      return JSON.parse(json);
    } catch {
      return INITIAL_DEMO_USERS;
    }
  }

  /**
   * Check if a mobile number is already registered locally
   */
  async isUserRegistered(mobile: string): Promise<boolean> {
    const registry = await this.getUsersRegistry();
    return Boolean(registry[mobile]);
  }

  /**
   * REGISTER VIA BACKEND API (Full Name, Email, Mobile, Password, Gender)
   */
  async registerWithBackend(payload: RegisterPayload): Promise<RegisterResult> {
    const cleanName = (payload.fullName || '').trim();
    const cleanEmail = (payload.email || '').trim().toLowerCase();
    const cleanMobile = (payload.mobileNumber || '').trim().replace(/\D/g, '');

    // 1. Basic client-side validation
    if (!cleanName || cleanName.length < 2) {
      return {
        success: false,
        error: 'Please enter a valid full name (minimum 2 characters).',
      };
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return {
        success: false,
        error: 'Please enter a valid email address.',
      };
    }

    if (cleanMobile && !/^[6-9]\d{9}$/.test(cleanMobile)) {
      return {
        success: false,
        error: 'Please enter a valid 10-digit Indian mobile number.',
      };
    }

    if (!payload.password || payload.password.length < 6) {
      return {
        success: false,
        error: 'Password must be at least 6 characters long.',
      };
    }

    if (
      payload.confirmPassword !== undefined &&
      payload.password !== payload.confirmPassword
    ) {
      return {
        success: false,
        error: 'Passwords do not match.',
      };
    }

    // 2. Attempt backend API call
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: cleanName,
          email: cleanEmail,
          mobileNumber: cleanMobile,
          password: payload.password,
          confirmPassword: payload.confirmPassword,
          gender: payload.gender || 'Men',
          termsAccepted: payload.termsAccepted ?? true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Registration failed. Please try again.',
        };
      }

      // Successful registration on backend
      const user: User = data.user;
      const token: string = data.token;

      // Persist session locally
      await this.saveSession(user, token);

      // Also sync into local cache
      const registry = await this.getUsersRegistry();
      delete registry[''];
      if (cleanMobile) registry[cleanMobile] = user;
      if (cleanEmail) registry[cleanEmail] = user;
      await AsyncStorage.setItem(
        STORAGE_KEYS.USERS_REGISTRY,
        JSON.stringify(registry)
      );

      return {
        success: true,
        user,
        token,
        message: data.message || 'Account created successfully!',
      };
    } catch {
      // Offline fallback: if backend is unreachable, gracefully fall back to local registration
      console.warn('Backend unavailable, falling back to local registration.');
      return this.registerUser(
        cleanMobile,
        cleanName,
        cleanEmail,
        payload.gender || 'Men',
        payload.password
      );
    }
  }

  /**
   * LOGIN VIA BACKEND API (Email/Mobile + Password)
   */
  async loginWithBackend(payload: LoginPayload): Promise<LoginResult> {
    const target = (payload.identifier || '').trim();

    if (!target) {
      return {
        success: false,
        error: 'Please enter your registered email or mobile number.',
      };
    }

    if (!payload.password) {
      return {
        success: false,
        error: 'Please enter your password.',
      };
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: target,
          password: payload.password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Invalid credentials.',
        };
      }

      const user: User = data.user;
      const token: string = data.token;

      await this.saveSession(user, token);

      return {
        success: true,
        user,
        token,
        message: data.message || 'Login successful!',
      };
    } catch {
      console.warn('Backend unavailable during login, checking local demo fallback.');
      const registry = await this.getUsersRegistry();
      delete registry[''];

      const targetLower = target.toLowerCase();
      let localUser =
        registry[target] ||
        registry[targetLower] ||
        Object.values(registry).find(
          (u) =>
            u.email?.toLowerCase() === targetLower ||
            (u.mobile && u.mobile === target.replace(/\D/g, ''))
        );

      if (!localUser && payload.password && payload.password.length >= 6) {
        const displayName = target.includes('@')
          ? target.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ')
          : 'Shopper';
        localUser = {
          id: `usr-${Date.now()}`,
          name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
          fullName: displayName.charAt(0).toUpperCase() + displayName.slice(1),
          email: target.includes('@') ? targetLower : undefined,
          mobile: target.includes('@') ? '' : target.replace(/\D/g, ''),
          role: 'customer',
          status: 'active',
          createdAt: new Date().toISOString(),
          insiderPoints: 200,
        };
        registry[target] = localUser;
        if (localUser.email) registry[localUser.email] = localUser;
        if (localUser.mobile) registry[localUser.mobile] = localUser;
        delete registry[''];

        await AsyncStorage.setItem(
          STORAGE_KEYS.USERS_REGISTRY,
          JSON.stringify(registry)
        );
      }

      if (localUser) {
        await this.saveSession(localUser);
        return {
          success: true,
          user: localUser,
          message: 'Login successful!',
        };
      }

      return {
        success: false,
        error: 'Unable to log in. Please check credentials.',
      };
    }
  }

  /**
   * SYNC CURRENT USER FROM BACKEND
   */
  async fetchMe(): Promise<User | null> {
    try {
      const token = await this.getToken();
      if (!token) return null;

      const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        await this.clearSession();
        return null;
      }

      const data = await response.json();
      if (response.ok && data.success && data.user) {
        const user: User = data.user;
        await this.saveSession(user, token);
        return user;
      }

      return null;
    } catch {
      // Return cached local session if offline
      return this.getSession();
    }
  }

  /**
   * Reset Password with OTP verification
   */
  async resetPassword(
    identifier: string,
    otp: string,
    newPassword: string
  ): Promise<LoginResult> {
    const cleanKey = identifier.trim().toLowerCase();
    const cleanOtp = otp.trim();

    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: cleanKey,
          otp: cleanOtp,
          newPassword,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        if (data.token && data.user) {
          await this.saveSession(data.user, data.token);
        }
        return {
          success: true,
          user: data.user,
          token: data.token,
          message: data.message || 'Password reset successfully!',
        };
      }
      return {
        success: false,
        error: data.error || 'Failed to reset password.',
      };
    } catch {
      return {
        success: false,
        error: 'Network error occurred while resetting password.',
      };
    }
  }

  /**
   * Initiate OTP request with rate limiting and expiration (Email or Mobile)
   */
  async sendOtp(identifier: string): Promise<SendOtpResult> {
    const raw = (identifier || '').trim();
    const isEmail = raw.includes('@');
    const cleanKey = isEmail ? raw.toLowerCase() : raw.replace(/\D/g, '');

    // Validate format
    if (isEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanKey)) {
        return {
          success: false,
          isExistingUser: false,
          error: 'Please enter a valid email address.',
        };
      }
    } else {
      if (!/^[6-9]\d{9}$/.test(cleanKey)) {
        return {
          success: false,
          isExistingUser: false,
          error: 'Please enter a valid 10-digit Indian mobile number.',
        };
      }
    }

    const now = Date.now();
    const existingOtp = activeOtps.get(cleanKey);

    // 30 seconds cooldown between resends
    if (existingOtp && now - existingOtp.lastSentAt < 30 * 1000) {
      const remainingSeconds = Math.ceil(
        (30 * 1000 - (now - existingOtp.lastSentAt)) / 1000
      );
      return {
        success: false,
        isExistingUser: await this.isUserRegistered(cleanKey),
        error: `Please wait ${remainingSeconds}s before requesting a new OTP.`,
        cooldownSeconds: remainingSeconds,
      };
    }

    // Call backend real-time send-otp endpoint with a 15s timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${getApiBaseUrl()}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanKey }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          activeOtps.set(cleanKey, {
            mobile: cleanKey,
            code: data.devOtp || '',
            expiresAt: now + 5 * 60 * 1000,
            lastSentAt: now,
            attempts: 0,
          });

          return {
            success: true,
            isExistingUser: !data.isNewUser,
            devOtp: data.devOtp, // Only set if backend is simulated
            cooldownSeconds: data.cooldownSeconds || 30,
            deliveryType: data.deliveryType,
            target: data.target,
            isLiveDelivery: Boolean(data.live),
          };
        } else {
          return {
            success: false,
            isExistingUser: false,
            error: data.error || 'Failed to dispatch OTP.',
          };
        }
      }
    } catch (err) {
      console.warn('Backend send-otp failed, falling back to local simulation:', err);
    }

    // Fallback: local simulation if server offline
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = now + 5 * 60 * 1000;

    activeOtps.set(cleanKey, {
      mobile: cleanKey,
      code,
      expiresAt,
      lastSentAt: now,
      attempts: 0,
    });

    const isExistingUser = await this.isUserRegistered(cleanKey);

    // Attempt live SMS dispatch if Fast2SMS or browser notification is available
    await this.dispatchLiveSms(cleanKey, code);

    return {
      success: true,
      isExistingUser,
      devOtp: code,
      cooldownSeconds: 30,
      isLiveDelivery: false,
    };
  }

  /**
   * Dispatch OTP notification safely without exposing private API keys in client bundle
   */
  private async dispatchLiveSms(mobile: string, code: string): Promise<boolean> {
    // 1. Dispatch real SMS via backend (Fast2SMS)
    try {
      fetch(`${getApiBaseUrl()}/auth/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp: code }),
      }).catch(() => {});
    } catch {}

    // 2. Trigger browser Web Notification if allowed
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('VK-MYNTRA', {
            body: `${code} is your OTP to login to Myntra. Valid for 5 mins. Do not share this OTP with anyone.`,
          });
        }
      }
    } catch {}

    return true;
  }

  /**
   * Verify the OTP entered by user (Email or Mobile)
   */
  async verifyOtp(identifier: string, enteredOtp: string): Promise<VerifyOtpResult> {
    const raw = (identifier || '').trim();
    const isEmail = raw.includes('@');
    const cleanKey = isEmail ? raw.toLowerCase() : raw.replace(/\D/g, '');
    const cleanOtp = (enteredOtp || '').trim();

    // Call backend OTP login endpoint with a 5s fast timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${getApiBaseUrl()}/auth/otp-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanKey, otp: cleanOtp }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          activeOtps.delete(cleanKey);
          if (data.isNewUser) {
            return {
              success: true,
              isNewUser: true,
            };
          }

          if (data.user && data.token) {
            const user: User = data.user;
            const token: string = data.token;
            await this.saveSession(user, token);
            return {
              success: true,
              isNewUser: false,
              user,
            };
          }
        } else {
          return {
            success: false,
            isNewUser: false,
            error: data.error || 'Invalid OTP code.',
          };
        }
      } else {
        const data = await response.json().catch(() => ({}));
        return {
          success: false,
          isNewUser: false,
          error: data.error || 'Invalid OTP code.',
        };
      }
    } catch (apiErr) {
      console.warn('Backend otp-login unavailable, checking local registry:', apiErr);
    }

    const record = activeOtps.get(cleanKey);

    if (!record) {
      return {
        success: false,
        isNewUser: false,
        error: 'No active OTP request found. Please request a new OTP.',
      };
    }

    // Check expiration
    if (Date.now() > record.expiresAt) {
      activeOtps.delete(cleanKey);
      return {
        success: false,
        isNewUser: false,
        error: 'This OTP has expired. Please tap Resend OTP.',
      };
    }

    // Check rate limit on attempts (max 4 tries)
    if (record.attempts >= 4) {
      activeOtps.delete(cleanKey);
      return {
        success: false,
        isNewUser: false,
        error: 'Too many incorrect attempts. Please request a new OTP.',
      };
    }

    // Strict validation against real dispatched OTP
    const isCodeMatch =
      record.code === cleanOtp ||
      (cleanOtp.length === 4 && cleanOtp === record.code);

    if (!isCodeMatch) {
      record.attempts += 1;
      const remaining = 4 - record.attempts;
      return {
        success: false,
        isNewUser: false,
        error: `Invalid OTP code. (${remaining} ${
          remaining === 1 ? 'attempt' : 'attempts'
        } remaining)`,
      };
    }

    // OTP is verified successfully -> clear it from active map
    activeOtps.delete(cleanKey);

    // Fallback: Check if user exists in the local registry
    const registry = await this.getUsersRegistry();
    const existingUser = registry[cleanKey];

    if (existingUser) {
      // Existing user -> automatically create and persist session
      await this.saveSession(existingUser);
      return {
        success: true,
        isNewUser: false,
        user: existingUser,
      };
    }

    // New user -> return isNewUser: true to proceed to Registration step
    return {
      success: true,
      isNewUser: true,
    };
  }

  /**
   * Complete new user registration (OTP legacy & local fallback)
   */
  async registerUser(
    mobile: string,
    name: string,
    email?: string,
    gender?: 'Men' | 'Women' | 'Other',
    password?: string
  ): Promise<RegisterResult> {
    const cleanNumber = mobile.trim().replace(/\D/g, '');
    const cleanName = name.trim();
    const cleanEmail = email?.trim().toLowerCase();

    if (!cleanName || cleanName.length < 2) {
      return {
        success: false,
        error: 'Please enter a valid full name (at least 2 characters).',
      };
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return {
        success: false,
        error: 'Please enter a valid email address.',
      };
    }

    const registry = await this.getUsersRegistry();
    // Clean up any empty string key pollution
    delete registry[''];

    // Check duplicate accounts only against valid keys
    if (cleanNumber && registry[cleanNumber]) {
      return {
        success: false,
        error: 'An account with this mobile number already exists.',
      };
    }

    if (cleanEmail && registry[cleanEmail]) {
      // Existing user registering with same email -> log in
      await this.saveSession(registry[cleanEmail]);
      return {
        success: true,
        user: registry[cleanEmail],
      };
    }

    const newUser: User = {
      id: `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      fullName: cleanName,
      mobile: cleanNumber,
      mobileNumber: cleanNumber,
      email: cleanEmail || undefined,
      gender: gender || 'Men',
      role: 'customer',
      status: 'active',
      createdAt: new Date().toISOString(),
      insiderPoints: 100, // Welcome bonus points
    };

    // Save to registry indexed by email and/or mobile
    if (cleanEmail) registry[cleanEmail] = newUser;
    if (cleanNumber) registry[cleanNumber] = newUser;
    delete registry[''];

    await AsyncStorage.setItem(
      STORAGE_KEYS.USERS_REGISTRY,
      JSON.stringify(registry)
    );

    // Save active session
    await this.saveSession(newUser);

    return {
      success: true,
      user: newUser,
    };
  }

  /**
   * Save user session to persistent storage
   */
  async saveSession(user: User, token?: string): Promise<void> {
    const sessionToken =
      token ||
      `myntra_tok_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const session: AuthSession = {
      user: {
        ...user,
        name: user.fullName || user.name,
        fullName: user.fullName || user.name,
        mobile: user.mobileNumber || user.mobile,
        mobileNumber: user.mobileNumber || user.mobile,
      },
      token: sessionToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    };
    await AsyncStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
  }

  /**
   * Load active session from persistent storage
   */
  async getSession(): Promise<User | null> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.SESSION);
      if (!json) return null;

      const session: AuthSession = JSON.parse(json);
      // Check if session token expired
      if (new Date(session.expiresAt).getTime() < Date.now()) {
        await this.clearSession();
        return null;
      }
      return session.user;
    } catch {
      return null;
    }
  }

  /**
   * Get active JWT/session token
   */
  async getToken(): Promise<string | null> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.SESSION);
      if (!json) return null;
      const session: AuthSession = JSON.parse(json);
      if (new Date(session.expiresAt).getTime() < Date.now()) {
        return null;
      }
      return session.token;
    } catch {
      return null;
    }
  }

  /**
   * Invalidate and clear active session
   */
  async clearSession(): Promise<void> {
    try {
      const token = await this.getToken();
      if (token) {
        // Notify backend logout asynchronously (fire-and-forget)
        fetch(`${getApiBaseUrl()}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).catch(() => {});
      }
      await AsyncStorage.removeItem(STORAGE_KEYS.SESSION);
    } catch (e) {
      console.warn('Failed to clear session:', e);
    }
  }

  /**
   * Update authenticated user profile details
   */
  async updateProfile(
    userId: string,
    updates: Partial<User>
  ): Promise<User | null> {
    try {
      const currentUser = await this.getSession();
      if (!currentUser || currentUser.id !== userId) return null;

      const updatedUser: User = {
        ...currentUser,
        ...updates,
        name: updates.fullName || updates.name || currentUser.name,
        fullName: updates.fullName || updates.name || currentUser.fullName,
      };

      // Try updating via backend if online
      const token = await this.getToken();
      if (token) {
        try {
          await fetch(`${getApiBaseUrl()}/auth/profile`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          });
        } catch (err) {
          console.warn('Backend updateProfile failed, saved locally:', err);
        }
      }

      // Update in local registry
      const registry = await this.getUsersRegistry();
      if (registry[currentUser.mobile]) {
        registry[currentUser.mobile] = updatedUser;
        await AsyncStorage.setItem(
          STORAGE_KEYS.USERS_REGISTRY,
          JSON.stringify(registry)
        );
      }

      // Update active session
      await this.saveSession(updatedUser, token || undefined);
      return updatedUser;
    } catch {
      return null;
    }
  }

  /**
   * Fetch authenticated user preferences from backend
   */
  async getPreferences(): Promise<UserPreferences | null> {
    try {
      const token = await this.getToken();
      if (!token) return null;

      const res = await fetch(`${getApiBaseUrl()}/auth/preferences`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (data.success && data.preferences) {
        return data.preferences;
      }
      return null;
    } catch (e) {
      console.warn('Failed to fetch preferences from backend:', e);
      return null;
    }
  }

  /**
   * Update user preferences on backend and sync local session
   */
  async updatePreferences(
    preferences: Partial<UserPreferences>
  ): Promise<boolean> {
    try {
      const token = await this.getToken();
      const currentUser = await this.getSession();

      if (currentUser && preferences.themePreference) {
        const updatedUser: User = {
          ...currentUser,
          themePreference: preferences.themePreference,
        };
        await this.saveSession(updatedUser, token || undefined);
      }

      if (!token) return true; // Saved locally for guest or offline

      const res = await fetch(`${getApiBaseUrl()}/auth/preferences`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });

      if (!res.ok) {
        console.warn('Backend updatePreferences returned status:', res.status);
        return false;
      }

      const data = await res.json();
      return Boolean(data.success);
    } catch (e) {
      console.warn('Backend updatePreferences failed (offline or network error):', e);
      return false;
    }
  }
}

export const authService = new AuthService();
