import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';

interface OtpVerificationStepProps {
  mobile: string;
  onVerify: (otp: string) => Promise<void>;
  onResend: () => Promise<void>;
  onEditMobile: () => void;
  onSwitchToPasswordLogin?: () => void;
  isLoading: boolean;
  errorMessage?: string;
  devOtp?: string;
  cooldownSeconds?: number;
  mode?: 'signup' | 'login' | 'reset';
}

export const OtpVerificationStep: React.FC<OtpVerificationStepProps> = ({
  mobile,
  onVerify,
  onResend,
  onEditMobile,
  onSwitchToPasswordLogin,
  isLoading,
  errorMessage,
  devOtp,
  cooldownSeconds = 30,
  mode = 'signup',
}) => {
  const [otp, setOtp] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(cooldownSeconds);
  const [showHelpAlert, setShowHelpAlert] = useState(false);

  // Mask destination for privacy
  const isEmail = mobile.includes('@');
  const maskedDestination = isEmail
    ? mobile
    : mobile.length === 10
      ? `+91 ${mobile.slice(0, 2)}••••••${mobile.slice(8)}`
      : `+91 ${mobile}`;

  // Countdown timer for Resend OTP
  useEffect(() => {
    if (secondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining]);

  // Auto-fill devOtp in demo / simulation mode
  useEffect(() => {
    if (devOtp && !otp) {
      setOtp(devOtp);
    }
  }, [devOtp]);

  const handleOtpChange = (text: string) => {
    const digitsOnly = text.replace(/\D/g, '').slice(0, 4);
    setOtp(digitsOnly);

    // Auto-submit when all 4 digits are typed
    if (digitsOnly.length === 4 && !isLoading) {
      onVerify(digitsOnly);
    }
  };

  const handleResendClick = async () => {
    if (secondsRemaining === 0 && !isLoading) {
      await onResend();
      setSecondsRemaining(30);
      setOtp('');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.headerContainer}>
        <View style={styles.iconCircle}>
          <Ionicons
            name={isEmail ? 'mail-unread-outline' : 'shield-checkmark'}
            size={28}
            color={MyntraColors.primary}
          />
        </View>

        <Text style={styles.title}>
          {mode === 'signup'
            ? (isEmail ? 'Verify Email to Sign Up' : 'Verify to Sign Up')
            : (isEmail ? 'Verify Email with OTP' : 'Verify with OTP')}
        </Text>
        <Text style={styles.subtitle}>
          Enter the 4-digit verification code sent to
        </Text>

        {/* Mobile/Email Row with Edit Button */}
        <View style={styles.mobileRow}>
          <Text style={styles.mobileText}>{maskedDestination}</Text>
          <TouchableOpacity
            onPress={onEditMobile}
            style={styles.editButton}
            activeOpacity={0.7}>
            <Text style={styles.editText}>EDIT</Text>
          </TouchableOpacity>
        </View>

        {isEmail && !devOtp && (
          <Text style={styles.inboxHintText}>
            📩 Check your inbox & spam folder for the 4-digit code
          </Text>
        )}
      </View>

      {/* Demo / Web Fallback OTP Banner */}
      {devOtp ? (
        <View style={styles.devOtpContainer}>
          <View style={styles.devOtpLeft}>
            <Ionicons name="key" size={16} color="#059669" />
            <Text style={styles.devOtpLabel}>
              Demo OTP: <Text style={styles.devOtpValue}>{devOtp}</Text>
            </Text>
          </View>
          <TouchableOpacity
            style={styles.devOtpButton}
            onPress={() => handleOtpChange(devOtp)}
            activeOpacity={0.8}>
            <Text style={styles.devOtpButtonText}>Auto-Fill</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 4-Digit OTP Cells */}
      <View style={styles.otpInputContainer}>
        {/* Hidden TextInput handling user input and paste */}
        <TextInput
          style={styles.hiddenInput}
          value={otp}
          onChangeText={handleOtpChange}
          keyboardType="number-pad"
          maxLength={4}
          autoFocus
        />

        {/* 4 Visual Boxes */}
        <View style={styles.boxesRow}>
          {[0, 1, 2, 3].map((index) => {
            const digit = otp[index] || '';
            const isCurrent = otp.length === index;

            return (
              <View
                key={index}
                style={[
                  styles.otpBox,
                  isCurrent && styles.otpBoxCurrent,
                  digit ? styles.otpBoxFilled : null,
                ]}>
                <Text style={styles.otpDigit}>{digit}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Error Message */}
      {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

      {/* Verify Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onVerify(otp)}
        disabled={otp.length !== 4 || isLoading}
        style={[
          styles.verifyButton,
          (otp.length !== 4 || isLoading) && styles.verifyButtonDisabled,
        ]}>
        {isLoading ? (
          <ActivityIndicator color={MyntraColors.white} size="small" />
        ) : (
          <Text style={styles.verifyButtonText}>VERIFY OTP</Text>
        )}
      </TouchableOpacity>

      {/* Resend OTP Section */}
      <View style={styles.resendContainer}>
        <Text style={styles.resendPrompt}>
          {"Didn't receive the OTP? "}
        </Text>
        {secondsRemaining > 0 ? (
          <Text style={styles.timerText}>
            Resend in <Text style={styles.timerBold}>{secondsRemaining}s</Text>
          </Text>
        ) : (
          <TouchableOpacity onPress={handleResendClick} activeOpacity={0.7}>
            <Text style={styles.resendActionText}>RESEND OTP</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Additional authentic Myntra login options */}
      <View style={styles.extraLinksContainer}>
        {onSwitchToPasswordLogin && (
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.extraLinkRow}
            onPress={onSwitchToPasswordLogin}>
            <Text style={styles.extraLinkText}>
              {mode === 'signup'
                ? 'Already have an account? Log In'
                : 'Log in using Password'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.helpRow}>
          <Text style={styles.helpText}>
            {mode === 'signup'
              ? 'Need help signing up? '
              : 'Have trouble logging in? '}
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowHelpAlert(!showHelpAlert)}>
            <Text style={styles.helpLink}>Get help</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showHelpAlert && (
        <View style={styles.helpBox}>
          <View style={styles.helpBoxHeader}>
            <Ionicons name="help-circle-outline" size={16} color={MyntraColors.primary} />
            <Text style={styles.helpBoxTitle}>Need help with OTP?</Text>
          </View>
          <Text style={styles.helpBoxDesc}>
            {isEmail
              ? 'Please check your email Inbox and Spam/Junk folder. If OTP is delayed, tap Resend OTP.'
              : 'Check network coverage on your phone. If SMS is delayed, tap Resend OTP.'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    backgroundColor: MyntraColors.white,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff0f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  subtitle: {
    fontSize: 12.5,
    color: MyntraColors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  mobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  mobileText: {
    fontSize: 13,
    fontWeight: '700',
    color: MyntraColors.text,
  },
  editButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#f5f5f6',
  },
  editText: {
    fontSize: 11,
    fontWeight: '800',
    color: MyntraColors.primary,
  },
  otpInputContainer: {
    marginVertical: Spacing.lg,
    position: 'relative',
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
    zIndex: 10,
  },
  boxesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  otpBox: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#d4d5d9',
    backgroundColor: '#fafafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxCurrent: {
    borderColor: MyntraColors.primary,
    backgroundColor: MyntraColors.white,
  },
  otpBoxFilled: {
    borderColor: '#535766',
    backgroundColor: MyntraColors.white,
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  errorText: {
    color: '#e53935',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
    fontWeight: '500',
  },
  verifyButton: {
    backgroundColor: MyntraColors.primary,
    height: 48,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: MyntraColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  verifyButtonDisabled: {
    backgroundColor: '#f4b0c1',
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyButtonText: {
    color: MyntraColors.white,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  resendPrompt: {
    fontSize: 12,
    color: MyntraColors.textSecondary,
  },
  timerText: {
    fontSize: 12,
    color: MyntraColors.textSecondary,
  },
  timerBold: {
    fontWeight: '700',
    color: MyntraColors.primary,
  },
  resendActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: MyntraColors.primary,
  },
  extraLinksContainer: {
    marginTop: 24,
    alignItems: 'center',
    gap: 12,
  },
  extraLinkRow: {
    paddingVertical: 4,
  },
  extraLinkText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: MyntraColors.primary,
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helpText: {
    fontSize: 12,
    color: MyntraColors.textSecondary,
  },
  helpLink: {
    fontSize: 12,
    fontWeight: '700',
    color: MyntraColors.primary,
  },
  helpBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff7f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffd0dc',
  },
  helpBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  helpBoxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: MyntraColors.primary,
  },
  helpBoxDesc: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    lineHeight: 16,
  },
  inboxHintText: {
    fontSize: 12,
    color: MyntraColors.primary,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
    backgroundColor: '#fff0f4',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  devOtpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  devOtpLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  devOtpLabel: {
    fontSize: 12.5,
    color: '#065f46',
    fontWeight: '500',
  },
  devOtpValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#047857',
    letterSpacing: 1.5,
  },
  devOtpButton: {
    backgroundColor: '#059669',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  devOtpButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
