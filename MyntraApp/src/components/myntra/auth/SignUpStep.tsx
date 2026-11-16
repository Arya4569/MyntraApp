import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { RegisterPayload } from '@/types/auth';

interface SignUpStepProps {
  onSignUp: (payload: RegisterPayload) => Promise<void>;
  onSwitchToLogin: () => void;
  isLoading: boolean;
  errorMessage?: string;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
}

export const SignUpStep: React.FC<SignUpStepProps> = ({
  onSignUp,
  onSwitchToLogin,
  isLoading,
  errorMessage,
  onOpenTerms,
  onOpenPrivacy,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gender, setGender] = useState<'Men' | 'Women' | 'Other'>('Men');
  const [termsAccepted, setTermsAccepted] = useState(true);

  // Show/Hide Password toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Field touched states for validation feedback
  const [touched, setTouched] = useState({
    fullName: false,
    email: false,
    mobile: false,
    password: false,
    confirmPassword: false,
  });

  // Track focused field for clean border highlight
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Sanitized values
  const cleanMobile = mobile.replace(/\D/g, '').slice(0, 10);

  // Field validations
  const isNameValid = fullName.trim().length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isMobileValid = /^[6-9]\d{9}$/.test(cleanMobile);
  const isPasswordValid = password.length >= 6;
  const isConfirmValid =
    confirmPassword.length > 0 && password === confirmPassword;

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: 'None', color: '#e0e0e0', percent: '0%' };
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 2) {
      return { score: 1, label: 'Weak', color: '#ef4444', percent: '33%' };
    } else if (score <= 3) {
      return { score: 2, label: 'Medium', color: '#f59e0b', percent: '66%' };
    } else {
      return { score: 3, label: 'Strong', color: '#10b981', percent: '100%' };
    }
  }, [password]);

  const canSubmit =
    isNameValid &&
    isEmailValid &&
    isMobileValid &&
    isPasswordValid &&
    isConfirmValid &&
    termsAccepted &&
    !isLoading;

  const handleSubmit = () => {
    setTouched({
      fullName: true,
      email: true,
      mobile: true,
      password: true,
      confirmPassword: true,
    });

    if (canSubmit) {
      onSignUp({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        mobileNumber: cleanMobile,
        password,
        confirmPassword,
        gender,
        termsAccepted,
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View style={styles.offerBadge}>
            <Ionicons name="sparkles" size={12} color="#ffffff" />
            <Text style={styles.offerBadgeText}>FLAT ₹500 OFF</Text>
          </View>
          <Text style={styles.offerSubtitle}>On your 1st order</Text>
        </View>
        <Text style={styles.heading}>Create Your Account</Text>
        <Text style={styles.subheading}>
          Join Myntra for seamless shopping, express delivery, and exclusive Insider rewards.
        </Text>
      </View>

      {/* Global Error Banner */}
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="#b91c1c" />
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* Full Name Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Full Name <Text style={styles.requiredStar}>*</Text>
        </Text>
        <TextInput
          style={[
            styles.input,
            focusedField === 'fullName' && styles.inputFocused,
            touched.fullName && !isNameValid && styles.inputError,
          ]}
          placeholder="e.g. Rahul Sharma"
          placeholderTextColor={MyntraColors.textMuted}
          value={fullName}
          onChangeText={setFullName}
          onFocus={() => setFocusedField('fullName')}
          onBlur={() => {
            setFocusedField(null);
            setTouched((p) => ({ ...p, fullName: true }));
          }}
          autoCapitalize="words"
        />
        {touched.fullName && !isNameValid && (
          <Text style={styles.fieldError}>
            Please enter your full name (minimum 2 characters).
          </Text>
        )}
      </View>

      {/* Email Address Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Email Address <Text style={styles.requiredStar}>*</Text>
        </Text>
        <TextInput
          style={[
            styles.input,
            focusedField === 'email' && styles.inputFocused,
            touched.email && !isEmailValid && styles.inputError,
          ]}
          placeholder="e.g. rahul.sharma@example.com"
          placeholderTextColor={MyntraColors.textMuted}
          value={email}
          onChangeText={setEmail}
          onFocus={() => setFocusedField('email')}
          onBlur={() => {
            setFocusedField(null);
            setTouched((p) => ({ ...p, email: true }));
          }}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {touched.email && !isEmailValid && (
          <Text style={styles.fieldError}>
            Please enter a valid email address.
          </Text>
        )}
      </View>

      {/* Mobile Number Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Mobile Number <Text style={styles.requiredStar}>*</Text>
        </Text>
        <View
          style={[
            styles.mobileInputRow,
            focusedField === 'mobile' && styles.inputFocused,
            touched.mobile && !isMobileValid && styles.inputError,
          ]}>
          <View style={styles.countryCodeBox}>
            <Text style={styles.countryCodeText}>+91</Text>
            <View style={styles.countryDivider} />
          </View>
          <TextInput
            style={styles.mobileInput}
            placeholder="10-digit mobile number"
            placeholderTextColor={MyntraColors.textMuted}
            keyboardType="phone-pad"
            maxLength={10}
            value={cleanMobile}
            onChangeText={setMobile}
            onFocus={() => setFocusedField('mobile')}
            onBlur={() => {
              setFocusedField(null);
              setTouched((p) => ({ ...p, mobile: true }));
            }}
          />
        </View>
        {touched.mobile && !isMobileValid && (
          <Text style={styles.fieldError}>
            Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).
          </Text>
        )}
      </View>

      {/* Password Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Password <Text style={styles.requiredStar}>*</Text>
        </Text>
        <View
          style={[
            styles.passwordRow,
            focusedField === 'password' && styles.inputFocused,
            touched.password && !isPasswordValid && styles.inputError,
          ]}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Create password (min 6 characters)"
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

        {/* Password Strength Meter */}
        {password.length > 0 && (
          <View style={styles.strengthContainer}>
            <View style={styles.strengthBarBackground}>
              <View
                style={[
                  styles.strengthBarFill,
                  {
                    width: passwordStrength.percent as any,
                    backgroundColor: passwordStrength.color,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.strengthLabel,
                { color: passwordStrength.color },
              ]}>
              Password strength: {passwordStrength.label}
            </Text>
          </View>
        )}

        {touched.password && !isPasswordValid && (
          <Text style={styles.fieldError}>
            Password must be at least 6 characters long.
          </Text>
        )}
      </View>

      {/* Confirm Password Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Confirm Password <Text style={styles.requiredStar}>*</Text>
        </Text>
        <View
          style={[
            styles.passwordRow,
            focusedField === 'confirmPassword' && styles.inputFocused,
            touched.confirmPassword && !isConfirmValid && styles.inputError,
          ]}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Re-enter password"
            placeholderTextColor={MyntraColors.textMuted}
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            onFocus={() => setFocusedField('confirmPassword')}
            onBlur={() => {
              setFocusedField(null);
              setTouched((p) => ({ ...p, confirmPassword: true }));
            }}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowConfirmPassword((p) => !p)}
            activeOpacity={0.7}>
            <Ionicons
              name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={MyntraColors.textSecondary}
            />
          </TouchableOpacity>
        </View>
        {touched.confirmPassword && !isConfirmValid && (
          <Text style={styles.fieldError}>
            {confirmPassword.length === 0
              ? 'Please confirm your password.'
              : 'Passwords do not match.'}
          </Text>
        )}
      </View>

      {/* Gender Selection */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Gender</Text>
        <View style={styles.genderRow}>
          {(['Men', 'Women', 'Other'] as const).map((item) => {
            const isSelected = gender === item;
            return (
              <TouchableOpacity
                key={item}
                onPress={() => setGender(item)}
                activeOpacity={0.8}
                style={[
                  styles.genderPill,
                  isSelected && styles.genderPillActive,
                ]}>
                <Text
                  style={[
                    styles.genderText,
                    isSelected && styles.genderTextActive,
                  ]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Terms & Conditions Checkbox */}
      <TouchableOpacity
        style={styles.termsRow}
        activeOpacity={0.8}
        onPress={() => setTermsAccepted((p) => !p)}>
        <View
          style={[
            styles.checkbox,
            termsAccepted && styles.checkboxActive,
          ]}>
          {termsAccepted && (
            <Ionicons name="checkmark" size={14} color="#ffffff" />
          )}
        </View>
        <View style={styles.termsTextWrap}>
          <Text style={styles.termsText}>
            I agree to Myntra&apos;s{' '}
            <Text
              style={styles.linkText}
              onPress={(e) => {
                e.stopPropagation?.();
                onOpenTerms?.();
              }}>
              Terms of Use
            </Text>{' '}
            &{' '}
            <Text
              style={styles.linkText}
              onPress={(e) => {
                e.stopPropagation?.();
                onOpenPrivacy?.();
              }}>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </TouchableOpacity>

      {/* Create Account Primary Action */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={[
          styles.createBtn,
          !canSubmit && styles.createBtnDisabled,
        ]}>
        {isLoading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.createBtnText}>CREATE ACCOUNT</Text>
        )}
      </TouchableOpacity>

      {/* Switch to Login Link */}
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <TouchableOpacity
          onPress={onSwitchToLogin}
          activeOpacity={0.7}
          disabled={isLoading}>
          <Text style={styles.loginLink}>Log In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    backgroundColor: MyntraColors.white,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  offerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: MyntraColors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  offerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  offerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: MyntraColors.discountOrange,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  subheading: {
    fontSize: 12.5,
    color: MyntraColors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
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
  requiredStar: {
    color: MyntraColors.primary,
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
  mobileInputRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    overflow: 'hidden',
  },
  countryCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: MyntraColors.text,
  },
  countryDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e2e8f0',
    marginLeft: 10,
  },
  mobileInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 10,
    fontSize: 14,
    color: MyntraColors.text,
    outlineStyle: 'none' as any,
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
  strengthContainer: {
    marginTop: 8,
    marginBottom: 2,
    gap: 5,
  },
  strengthBarBackground: {
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderPill: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  genderPillActive: {
    borderColor: MyntraColors.primary,
    backgroundColor: '#fff0f3',
  },
  genderText: {
    fontSize: 13,
    fontWeight: '600',
    color: MyntraColors.textSecondary,
  },
  genderTextActive: {
    color: MyntraColors.primary,
    fontWeight: '700',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: MyntraColors.primary,
    borderColor: MyntraColors.primary,
  },
  termsTextWrap: {
    flex: 1,
  },
  termsText: {
    fontSize: 11.5,
    color: MyntraColors.textSecondary,
    lineHeight: 18,
  },
  linkText: {
    color: MyntraColors.primary,
    fontWeight: '700',
  },
  createBtn: {
    height: 50,
    backgroundColor: MyntraColors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: MyntraColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  createBtnDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  createBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
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
  loginLink: {
    fontSize: 13,
    fontWeight: '800',
    color: MyntraColors.primary,
  },
});
