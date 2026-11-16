export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export interface UserPreferences {
  themePreference: ThemeMode;
}

export interface User {
  id: string;
  name: string;
  fullName?: string;
  mobile: string;
  mobileNumber?: string;
  email?: string;
  gender?: 'Men' | 'Women' | 'Other';
  role?: 'customer' | 'admin';
  status?: 'active' | 'suspended';
  profileImage?: string | null;
  themePreference?: ThemeMode;
  createdAt: string;
  updatedAt?: string;
  insiderPoints: number;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: string;
}

export interface SendOtpResult {
  success: boolean;
  isExistingUser: boolean;
  error?: string;
  devOtp?: string; // Visible in development mode when real SMS/email gateway is not configured
  cooldownSeconds?: number;
  deliveryType?: string;
  target?: string;
  isLiveDelivery?: boolean;
}

export interface VerifyOtpResult {
  success: boolean;
  isNewUser: boolean;
  user?: User;
  error?: string;
}

export interface RegisterResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
  message?: string;
}

export interface LoginResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
  message?: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  mobileNumber: string;
  password?: string;
  confirmPassword?: string;
  gender?: 'Men' | 'Women' | 'Other';
  termsAccepted?: boolean;
}

export interface LoginPayload {
  identifier: string; // email or mobile
  password?: string;
}
