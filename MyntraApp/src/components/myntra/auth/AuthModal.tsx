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

import { LoginMobileStep } from './LoginMobileStep';
import { OtpVerificationStep } from './OtpVerificationStep';
import { PasswordLoginStep } from './PasswordLoginStep';
import { RegistrationStep } from './RegistrationStep';
import { SignUpStep } from './SignUpStep';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { useAuth } from '@/context/AuthContext';
import { LoginPayload, RegisterPayload } from '@/types/auth';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
  initialMode?: 'login' | 'signup';
}

type AuthStep = 'mobile' | 'otp' | 'register' | 'signup' | 'password_login';

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
    isLiveProvider,
    authError,
    clearAuthError,
  } = useAuth();

  const [step, setStep] = useState<AuthStep>(
    initialMode === 'signup' ? 'signup' : 'mobile'
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
      setStep(initialMode === 'signup' ? 'signup' : 'mobile');
      setErrorMessage(undefined);
      clearAuthError();
    }, 0);
    return () => clearTimeout(timer);
  }, [visible, initialMode, clearAuthError]);

  const resetState = () => {
    setStep(initialMode === 'signup' ? 'signup' : 'mobile');
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

  // Step 1: Submit Mobile Number -> Send OTP
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
        if (result.devOtp) {
          setSmsNotification(result.devOtp);
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
        if (result.devOtp) {
          setSmsNotification(result.devOtp);
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

    try {
      let result;
      if (password && email) {
        result = await registerWithBackend({
          fullName: name,
          email,
          mobileNumber: mobile,
          password,
          confirmPassword: password,
          gender,
          termsAccepted: true,
        });
      } else {
        result = await registerUser(mobile, name, email, gender);
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

  // Direct Sign Up with full form (backend registration)
  const handleDirectSignUp = async (payload: RegisterPayload) => {
    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      const result = await registerWithBackend(payload);
      if (result.success) {
        onSuccess?.(
          `Welcome to Myntra, ${result.user?.name || payload.fullName}! 🎉`
        );
        handleClose();
      } else {
        setErrorMessage(result.error || 'Registration failed.');
      }
    } catch {
      setErrorMessage('Could not complete registration. Please check connection.');
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
              {step !== 'mobile' && step !== 'signup' ? (
                <TouchableOpacity
                  onPress={() => {
                    setErrorMessage(undefined);
                    setStep('mobile');
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

              {/* Tabs Switcher for Mobile / Signup Root Views */}
              {(step === 'mobile' || step === 'signup' || step === 'password_login') && (
                <View style={styles.headerTabs}>
                  <TouchableOpacity
                    style={[
                      styles.headerTab,
                      (step === 'mobile' || step === 'password_login') &&
                        styles.headerTabActive,
                    ]}
                    onPress={() => {
                      setErrorMessage(undefined);
                      setStep('mobile');
                    }}>
                    <Text
                      style={[
                        styles.headerTabText,
                        (step === 'mobile' || step === 'password_login') &&
                          styles.headerTabTextActive,
                      ]}>
                      LOG IN
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.headerTab,
                      step === 'signup' && styles.headerTabActive,
                    ]}
                    onPress={() => {
                      setErrorMessage(undefined);
                      setStep('signup');
                    }}>
                    <Text
                      style={[
                        styles.headerTabText,
                        step === 'signup' && styles.headerTabTextActive,
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

            {/* Simulated Phone SMS Push Notification Banner */}
            {step === 'otp' && smsNotification && (
              <View style={styles.smsBanner}>
                <View style={styles.smsHeader}>
                  <View style={styles.smsIcon}>
                    <Ionicons name="chatbubble" size={12} color="#ffffff" />
                  </View>
                  <Text style={styles.smsAppTitle}>MESSAGES</Text>
                  <Text style={styles.smsTime}>• now</Text>
                  <TouchableOpacity
                    onPress={() => setSmsNotification(null)}
                    style={styles.smsCloseBtn}
                    activeOpacity={0.7}>
                    <Ionicons name="close" size={14} color="#9ca3af" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.smsSender}>VK-MYNTRA</Text>
                <Text style={styles.smsText}>
                  <Text style={styles.smsOtpBold}>{smsNotification}</Text> is
                  your OTP to login to Myntra. Valid for 5 mins. Do not share this
                  OTP with anyone.
                </Text>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.smsAutoFill}
                  onPress={() => handleVerifyOtp(smsNotification)}>
                  <Ionicons name="flash" size={12} color="#38bdf8" />
                  <Text style={styles.smsAutoFillText}>
                    Tap to auto-fill OTP ({smsNotification})
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Scrollable Form Body */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              {step === 'mobile' && (
                <LoginMobileStep
                  onContinue={handleContinueMobile}
                  isLoading={isLoading}
                  errorMessage={currentError}
                  isLiveProvider={isLiveProvider}
                  onSwitchToSignUp={() => {
                    setErrorMessage(undefined);
                    setStep('signup');
                  }}
                  onSwitchToPasswordLogin={() => {
                    setErrorMessage(undefined);
                    setStep('password_login');
                  }}
                />
              )}

              {step === 'password_login' && (
                <PasswordLoginStep
                  onLogin={handlePasswordLogin}
                  onSwitchToSignUp={() => {
                    setErrorMessage(undefined);
                    setStep('signup');
                  }}
                  onSwitchToOtp={() => {
                    setErrorMessage(undefined);
                    setStep('mobile');
                  }}
                  isLoading={isLoading}
                  errorMessage={currentError}
                />
              )}

              {step === 'signup' && (
                <SignUpStep
                  onSignUp={handleDirectSignUp}
                  onSwitchToLogin={() => {
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
                  onEditMobile={() => setStep('mobile')}
                  isLoading={isLoading}
                  errorMessage={currentError}
                  devOtp={devOtp}
                  cooldownSeconds={cooldownSeconds}
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
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetWrapper: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
  },
  sheetContainer: {
    backgroundColor: MyntraColors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '94%',
    overflow: 'hidden',
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
