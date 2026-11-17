import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { LoginPayload } from '@/types/auth';

interface PasswordLoginStepProps {
  onLogin: (payload: LoginPayload) => Promise<void>;
  onSwitchToSignUp: () => void;
  onSwitchToOtp?: () => void;
  onForgotPassword: () => void;
  isLoading: boolean;
  errorMessage?: string;
}

export const PasswordLoginStep: React.FC<PasswordLoginStepProps> = ({
  onLogin,
  onSwitchToSignUp,
  onSwitchToOtp,
  onForgotPassword,
  isLoading,
  errorMessage,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ identifier: false, password: false });
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const isIdentifierValid = identifier.trim().length >= 3;
  const isPasswordValid = password.length >= 6;
  const canSubmit = isIdentifierValid && isPasswordValid && !isLoading;

  const handleSubmit = () => {
    setTouched({ identifier: true, password: true });
    if (canSubmit) {
      onLogin({
        identifier: identifier.trim(),
        password,
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Banner */}
      <View style={styles.bannerContainer}>
        <Image
          source={{
            uri: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80',
          }}
          style={styles.bannerImage}
          resizeMode="cover"
        />
        <View style={styles.bannerOverlay}>
          <View style={styles.discountTag}>
            <Text style={styles.discountTagText}>FLAT ₹500 OFF</Text>
          </View>
          <Text style={styles.bannerTitle}>Welcome Back</Text>
          <Text style={styles.bannerSub}>Sign in to access your Bag & Orders</Text>
        </View>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.title}>Login with Password</Text>
        <Text style={styles.subtitle}>
          Enter your registered email address or mobile number.
        </Text>

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color="#b91c1c" />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Identifier Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email or Mobile Number</Text>
          <TextInput
            style={[
              styles.input,
              focusedField === 'identifier' && styles.inputFocused,
              touched.identifier && !isIdentifierValid && styles.inputError,
            ]}
            placeholder="e.g. 9876543210 or name@email.com"
            placeholderTextColor={MyntraColors.textMuted}
            value={identifier}
            onChangeText={setIdentifier}
            onFocus={() => setFocusedField('identifier')}
            onBlur={() => {
              setFocusedField(null);
              setTouched((p) => ({ ...p, identifier: true }));
            }}
            autoCapitalize="none"
          />
          {touched.identifier && !isIdentifierValid && (
            <Text style={styles.fieldError}>
              Please enter your registered email or mobile number.
            </Text>
          )}
        </View>

        {/* Password Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Password</Text>
          <View
            style={[
              styles.passwordRow,
              focusedField === 'password' && styles.inputFocused,
              touched.password && !isPasswordValid && styles.inputError,
            ]}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter your password"
              placeholderTextColor={MyntraColors.textMuted}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField('password')}
              onBlur={() => {
                setFocusedField(null);
                setTouched((p) => ({ ...p, password: true }));
              }}
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
          {touched.password && !isPasswordValid && (
            <Text style={styles.fieldError}>Password is required.</Text>
          )}
        </View>

        {/* Forgot Password Link */}
        <View style={styles.forgotPasswordRow}>
          <TouchableOpacity
            onPress={onForgotPassword}
            activeOpacity={0.7}
            disabled={isLoading}>
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={[styles.loginBtn, !canSubmit && styles.loginBtnDisabled]}>
          {isLoading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.loginBtnText}>LOG IN</Text>
          )}
        </TouchableOpacity>

        {/* Sign Up Link */}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>New to Myntra?</Text>
          <TouchableOpacity
            onPress={onSwitchToSignUp}
            activeOpacity={0.7}
            disabled={isLoading}>
            <Text style={styles.signUpLink}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: MyntraColors.white,
  },
  bannerContainer: {
    height: 140,
    position: 'relative',
    backgroundColor: '#1f2937',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFill,
    padding: Spacing.lg,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  discountTag: {
    alignSelf: 'flex-start',
    backgroundColor: MyntraColors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6,
  },
  discountTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  bannerSub: {
    fontSize: 12,
    color: '#f3f4f6',
    marginTop: 2,
  },
  formContainer: {
    padding: Spacing.xl,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  subtitle: {
    fontSize: 12,
    color: MyntraColors.textSecondary,
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  errorBanner: {
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
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: MyntraColors.text,
    marginBottom: 7,
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
    outlineStyle: 'none' as any,
  },
  inputFocused: {
    borderColor: '#282c3f',
    backgroundColor: '#ffffff',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fff5f5',
  },
  fieldError: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 5,
    fontWeight: '500',
  },
  passwordRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    paddingLeft: 14,
    paddingRight: 6,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: MyntraColors.text,
    paddingVertical: 0,
    paddingHorizontal: 0,
    outlineStyle: 'none' as any,
  },
  eyeBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forgotPasswordRow: {
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
    marginTop: -4,
  },
  forgotPasswordText: {
    fontSize: 12,
    fontWeight: '700',
    color: MyntraColors.primary,
  },
  loginBtn: {
    height: 50,
    backgroundColor: MyntraColors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
    shadowColor: MyntraColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  loginBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
  otpSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderWidth: 1,
    borderColor: MyntraColors.primary,
    borderRadius: 8,
    marginTop: Spacing.md,
  },
  otpSwitchText: {
    fontSize: 13,
    fontWeight: '700',
    color: MyntraColors.primary,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.lg,
  },
  footerText: {
    fontSize: 13,
    color: MyntraColors.textSecondary,
  },
  signUpLink: {
    fontSize: 13,
    fontWeight: '800',
    color: MyntraColors.primary,
  },
});
