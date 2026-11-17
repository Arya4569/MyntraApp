import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ForgotPasswordStep } from './ForgotPasswordStep';
import { LoginMobileStep } from './LoginMobileStep';
import { OtpVerificationStep } from './OtpVerificationStep';
import { PasswordLoginStep } from './PasswordLoginStep';
import { RegistrationStep } from './RegistrationStep';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { useAuth } from '@/context/AuthContext';
import { LoginPayload } from '@/types/auth';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
  initialMode?: 'login' | 'signup';
}

type AuthStep =
  | 'password_login'
  | 'signup_otp'
  | 'otp'
  | 'register'
  | 'forgot_password';

export const AuthModal: React.FC<AuthModalProps> = ({
  visible,
  onClose,
  onSuccess,
  initialMode = 'login',
}) => {
  const {
    sendOtp,
    verifyOtp,
    registerUser,
    registerWithBackend,
    loginWithBackend,
    resetPassword,
    isLiveProvider,
    authError,
    clearAuthError,
  } = useAuth();

  const [step, setStep] = useState<AuthStep>(
    initialMode === 'signup' ? 'signup_otp' : 'password_login'
  );
  const [mobile, setMobile] = useState('');
  const [devOtp, setDevOtp] = useState<string | undefined>(undefined);
  const [smsNotification, setSmsNotification] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(30);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  // Sync initialMode when modal opens
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setStep(initialMode === 'signup' ? 'signup_otp' : 'password_login');
      setErrorMessage(undefined);
      clearAuthError();
    }, 0);
    return () => clearTimeout(timer);
  }, [visible, initialMode, clearAuthError]);

  const resetState = () => {
    setStep(initialMode === 'signup' ? 'signup_otp' : 'password_login');
    setMobile('');
    setDevOtp(undefined);
    setSmsNotification(null);
    setErrorMessage(undefined);
    setIsLoading(false);
    clearAuthError();
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Step 1: Submit Email for Sign Up -> Send OTP
  const handleContinueMobile = async (enteredMobile: string) => {
    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      const result = await sendOtp(enteredMobile);
      if (result.success) {
        setMobile(enteredMobile);
        setDevOtp(result.devOtp);
        setCooldownSeconds(result.cooldownSeconds || 30);
        setStep('otp');
        // Only show simulated auto-fill banner if live delivery is NOT active
        if (result.devOtp && !result.isLiveDelivery) {
          setSmsNotification(result.devOtp);
        } else {
          setSmsNotification(null);
        }
      } else {
        setErrorMessage(result.error || 'Failed to send OTP.');
      }
    } catch {
      setErrorMessage('Network error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Submit OTP -> Verify
  const handleVerifyOtp = async (enteredOtp: string) => {
    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      const result = await verifyOtp(mobile, enteredOtp);

      if (result.success) {
        setSmsNotification(null);
        if (result.isNewUser) {
          // New user needs to complete profile
          setStep('register');
        } else {
          // Existing user logged in directly
          onSuccess?.(`Welcome back, ${result.user?.name || 'Shopper'}! 👋`);
          handleClose();
        }
      } else {
        setErrorMessage(result.error || 'Invalid OTP code.');
      }
    } catch {
      setErrorMessage('Verification failed. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      const result = await sendOtp(mobile);
      if (result.success) {
        setDevOtp(result.devOtp);
        setCooldownSeconds(result.cooldownSeconds || 30);
        if (result.devOtp && !result.isLiveDelivery) {
          setSmsNotification(result.devOtp);
        } else {
          setSmsNotification(null);
        }
      } else {
        setErrorMessage(result.error);
      }
    } catch {
      setErrorMessage('Failed to resend OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // Register user after OTP verification
  const handleOtpRegister = async (
    name: string,
    email?: string,
    gender?: 'Men' | 'Women' | 'Other',
    password?: string
  ) => {
    setIsLoading(true);
    setErrorMessage(undefined);

    const isEmailAuth = mobile.includes('@');
    const effectiveEmail = isEmailAuth ? mobile : email;
    const effectiveMobile = isEmailAuth ? '' : mobile;

    try {
      let result;
      if (password && effectiveEmail) {
        result = await registerWithBackend({
          fullName: name,
          email: effectiveEmail,
          mobileNumber: effectiveMobile,
          password,
          confirmPassword: password,
          gender,
          termsAccepted: true,
        });
      } else {
        result = await registerUser(
          effectiveMobile,
          name,
          effectiveEmail,
          gender,
          password
        );
      }

      if (result.success) {
        onSuccess?.(`Welcome to Myntra, ${result.user?.name || name}! 🎉`);
        handleClose();
      } else {
        setErrorMessage(result.error || 'Registration failed.');
      }
    } catch {
      setErrorMessage('Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Password Login
  const handlePasswordLogin = async (payload: LoginPayload) => {
    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      const result = await loginWithBackend(payload);
      if (result.success) {
        onSuccess?.(`Welcome back, ${result.user?.name || 'Shopper'}! 👋`);
        handleClose();
      } else {
        setErrorMessage(result.error || 'Invalid login credentials.');
      }
    } catch {
      setErrorMessage('Login failed. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset Password via OTP
  const handleResetPassword = async (
    email: string,
    otp: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      const result = await resetPassword(email, otp, newPassword);
      if (result.success) {
        onSuccess?.('Password reset successfully! Welcome back! 🎉');
        handleClose();
        return { success: true };
      } else {
        setErrorMessage(result.error || 'Failed to reset password.');
        return { success: false, error: result.error };
      }
    } catch {
      const err = 'Reset failed. Please check connection.';
      setErrorMessage(err);
      return { success: false, error: err };
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendResetOtp = async (email: string) => {
    setIsLoading(true);
    setErrorMessage(undefined);
    try {
      const result = await sendOtp(email);
      if (result.success) {
        setMobile(email);
        setDevOtp(result.devOtp);
        setCooldownSeconds(result.cooldownSeconds || 30);
        return result;
      } else {
        setErrorMessage(result.error);
        return result;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const currentError = errorMessage || authError || undefined;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrapper}>
          <View style={styles.sheetContainer}>
            {/* Top Navigation Bar */}
            <View style={styles.navBar}>
              {step !== 'password_login' && step !== 'signup_otp' ? (
                <TouchableOpacity
                  onPress={() => {
                    setErrorMessage(undefined);
                    if (step === 'forgot_password') {
                      setStep('password_login');
                    } else if (step === 'otp') {
                      setStep('signup_otp');
                    } else if (step === 'register') {
                      setStep('signup_otp');
                    } else {
                      setStep('password_login');
                    }
                  }}
                  style={styles.navButton}
                  activeOpacity={0.7}>
                  <Ionicons
                    name="arrow-back"
                    size={22}
                    color={MyntraColors.text}
                  />
                </TouchableOpacity>
              ) : (
                <View style={styles.brandSmall}>
                  <View style={styles.brandBadge}>
                    <Text style={styles.brandLetter}>M</Text>
                  </View>
                  <Text style={styles.brandTitle}>MYNTRA</Text>
                </View>
              )}

              {/* Tabs Switcher for Login / Signup Root Views */}
              {(step === 'password_login' || step === 'signup_otp') && (
                <View style={styles.headerTabs}>
                  <TouchableOpacity
                    style={[
                      styles.headerTab,
                      step === 'password_login' && styles.headerTabActive,
                    ]}
                    onPress={() => {
                      setErrorMessage(undefined);
                      setStep('password_login');
                    }}>
                    <Text
                      style={[
                        styles.headerTabText,
                        step === 'password_login' && styles.headerTabTextActive,
                      ]}>
                      LOG IN
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.headerTab,
                      step === 'signup_otp' && styles.headerTabActive,
                    ]}
                    onPress={() => {
                      setErrorMessage(undefined);
                      setStep('signup_otp');
                    }}>
                    <Text
                      style={[
                        styles.headerTabText,
                        step === 'signup_otp' && styles.headerTabTextActive,
                      ]}>
                      SIGN UP
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                onPress={handleClose}
                style={styles.navButton}
                activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={MyntraColors.text} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Form Body */}
            <ScrollView
              style={styles.scrollContainer}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled">
              {step === 'password_login' && (
                <PasswordLoginStep
                  onLogin={handlePasswordLogin}
                  onSwitchToSignUp={() => {
                    setErrorMessage(undefined);
                    setStep('signup_otp');
                  }}
                  onForgotPassword={() => {
                    setErrorMessage(undefined);
                    setStep('forgot_password');
                  }}
                  isLoading={isLoading}
                  errorMessage={currentError}
                />
              )}

              {step === 'signup_otp' && (
                <LoginMobileStep
                  mode="signup"
                  onContinue={handleContinueMobile}
                  isLoading={isLoading}
                  errorMessage={currentError}
                  isLiveProvider={isLiveProvider}
                  onSwitchToPasswordLogin={() => {
                    setErrorMessage(undefined);
                    setStep('password_login');
                  }}
                />
              )}

              {step === 'forgot_password' && (
                <ForgotPasswordStep
                  onSendOtp={handleSendResetOtp}
                  onResetPassword={handleResetPassword}
                  onBackToLogin={() => {
                    setErrorMessage(undefined);
                    setStep('password_login');
                  }}
                  isLoading={isLoading}
                  errorMessage={currentError}
                />
              )}

              {step === 'otp' && (
                <OtpVerificationStep
                  mobile={mobile}
                  onVerify={handleVerifyOtp}
                  onResend={handleResendOtp}
                  onEditMobile={() => setStep('signup_otp')}
                  onSwitchToPasswordLogin={() => {
                    setErrorMessage(undefined);
                    setStep('password_login');
                  }}
                  isLoading={isLoading}
                  errorMessage={currentError}
                  devOtp={devOtp}
                  cooldownSeconds={cooldownSeconds}
                  mode="signup"
                />
              )}

              {step === 'register' && (
                <RegistrationStep
                  mobile={mobile}
                  onRegister={handleOtpRegister}
                  isLoading={isLoading}
                  errorMessage={currentError}
                />
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: 'center',
    padding: Platform.OS === 'web' ? 16 : 0,
  },
  sheetWrapper: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 440 : undefined,
    maxHeight: '92%',
  },
  sheetContainer: {
    backgroundColor: MyntraColors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: Platform.OS === 'web' ? 20 : 0,
    borderBottomRightRadius: Platform.OS === 'web' ? 20 : 0,
    maxHeight: '100%',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  scrollContainer: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f2f6',
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandBadge: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: MyntraColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: MyntraColors.text,
  },
  headerTabs: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    padding: 3,
  },
  headerTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  headerTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: MyntraColors.textSecondary,
    letterSpacing: 0.5,
  },
  headerTabTextActive: {
    color: MyntraColors.primary,
  },
  smsBanner: {
    marginHorizontal: Spacing.lg,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  smsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  smsIcon: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smsAppTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9ca3af',
    letterSpacing: 0.5,
  },
  smsTime: {
    fontSize: 10,
    color: '#6b7280',
  },
  smsCloseBtn: {
    marginLeft: 'auto',
    padding: 2,
  },
  smsSender: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 2,
  },
  smsText: {
    fontSize: 12,
    color: '#d1d5db',
    lineHeight: 16,
  },
  smsOtpBold: {
    fontSize: 14,
    fontWeight: '900',
    color: '#38bdf8',
    letterSpacing: 1,
  },
  smsAutoFill: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  smsAutoFillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
  },
});
