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

interface ForgotPasswordStepProps {
  onSendOtp: (email: string) => Promise<{
    success: boolean;
    error?: string;
    devOtp?: string;
    isLiveDelivery?: boolean;
    cooldownSeconds?: number;
  }>;
  onResetPassword: (
    email: string,
    otp: string,
    newPassword: string
  ) => Promise<{ success: boolean; error?: string }>;
  onBackToLogin: () => void;
  isLoading: boolean;
  errorMessage?: string;
}

export const ForgotPasswordStep: React.FC<ForgotPasswordStepProps> = ({
  onSendOtp,
  onResetPassword,
  onBackToLogin,
  isLoading,
  errorMessage,
}) => {
  const [step, setStep] = useState<'request_otp' | 'verify_and_reset'>('request_otp');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const cleanEmail = email.trim().toLowerCase();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
  const isPasswordValid = newPassword.length >= 6;
  const isConfirmValid = confirmPassword.length > 0 && newPassword === confirmPassword;
  const isOtpValid = otp.trim().length === 4;

  const handleSendOtp = async () => {
    if (!isEmailValid) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    setLocalError(null);
    const res = await onSendOtp(cleanEmail);
    if (res.success) {
      setStep('verify_and_reset');
      setCooldown(res.cooldownSeconds || 30);
      if (res.devOtp) {
        setOtp(res.devOtp);
      }
    } else {
      setLocalError(res.error || 'Failed to send OTP.');
    }
  };

  const handleReset = async () => {
    if (!isOtpValid) {
      setLocalError('Please enter the 4-digit OTP sent to your email.');
      return;
    }
    if (!isPasswordValid) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    if (!isConfirmValid) {
      setLocalError('Passwords do not match.');
      return;
    }
    setLocalError(null);
    const res = await onResetPassword(cleanEmail, otp.trim(), newPassword);
    if (!res.success) {
      setLocalError(res.error || 'Failed to reset password.');
    }
  };

  const activeError = localError || errorMessage;

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="key-outline" size={28} color={MyntraColors.primary} />
      </View>

      <Text style={styles.heading}>Reset Your Password</Text>
      <Text style={styles.subheading}>
        {step === 'request_otp'
          ? 'Enter your registered email address to receive an OTP.'
          : `We sent a 4-digit OTP to ${cleanEmail}.`}
      </Text>

      {activeError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="#b91c1c" />
          <Text style={styles.errorBannerText}>{activeError}</Text>
        </View>
      ) : null}

      {step === 'request_otp' ? (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Registered Email</Text>
            <TextInput
              style={styles.input}
              placeholder="name@email.com"
              placeholderTextColor={MyntraColors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, (!isEmailValid || isLoading) && styles.btnDisabled]}
            onPress={handleSendOtp}
            disabled={!isEmailValid || isLoading}
            activeOpacity={0.85}>
            {isLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>SEND OTP</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>4-Digit Email OTP</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="• • • •"
              placeholderTextColor={MyntraColors.textMuted}
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>New Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="At least 6 characters"
                placeholderTextColor={MyntraColors.textMuted}
                secureTextEntry={!showPassword}
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((p) => !p)}
                activeOpacity={0.7}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={MyntraColors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-type new password"
              placeholderTextColor={MyntraColors.textMuted}
              secureTextEntry={!showPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!isOtpValid || !isPasswordValid || !isConfirmValid || isLoading) &&
                styles.btnDisabled,
            ]}
            onPress={handleReset}
            disabled={!isOtpValid || !isPasswordValid || !isConfirmValid || isLoading}
            activeOpacity={0.85}>
            {isLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>RESET & LOG IN</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendRow}>
            {cooldown > 0 ? (
              <Text style={styles.cooldownText}>Resend OTP in {cooldown}s</Text>
            ) : (
              <TouchableOpacity onPress={handleSendOtp} disabled={isLoading}>
                <Text style={styles.resendText}>Resend OTP</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBackToLogin}
        disabled={isLoading}
        activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={16} color={MyntraColors.textSecondary} />
        <Text style={styles.backBtnText}>Back to Log In</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    backgroundColor: MyntraColors.white,
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff0f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    color: MyntraColors.text,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 12.5,
    color: MyntraColors.textSecondary,
    marginTop: 4,
    marginBottom: Spacing.lg,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 10,
    borderRadius: 8,
    marginBottom: Spacing.md,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: MyntraColors.text,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 14,
    color: MyntraColors.text,
    backgroundColor: '#fafafa',
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 20,
    letterSpacing: 8,
    fontWeight: '800',
  },
  passwordRow: {
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    fontSize: 14,
    color: MyntraColors.text,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtn: {
    width: '100%',
    height: 50,
    backgroundColor: MyntraColors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: MyntraColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
  resendRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 12,
    fontWeight: '700',
    color: MyntraColors.primary,
  },
  cooldownText: {
    fontSize: 12,
    color: MyntraColors.textMuted,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.lg,
    padding: 8,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: MyntraColors.textSecondary,
  },
});
