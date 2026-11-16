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

interface RegistrationStepProps {
  mobile: string;
  onRegister: (
    name: string,
    email?: string,
    gender?: 'Men' | 'Women' | 'Other',
    password?: string
  ) => Promise<void>;
  isLoading: boolean;
  errorMessage?: string;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
}

export const RegistrationStep: React.FC<RegistrationStepProps> = ({
  mobile,
  onRegister,
  isLoading,
  errorMessage,
  onOpenTerms,
  onOpenPrivacy,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(mobile && mobile.includes('@') ? mobile : '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [gender, setGender] = useState<'Men' | 'Women' | 'Other'>('Men');
  const [termsAccepted, setTermsAccepted] = useState(true);

  const [touched, setTouched] = useState({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const isNameValid = name.trim().length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isPasswordValid = password.length >= 6;
  const isConfirmValid =
    confirmPassword.length > 0 && password === confirmPassword;

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    if (!password) return { label: 'None', color: '#e0e0e0', percent: '0%' };
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 2) {
      return { label: 'Weak', color: '#ef4444', percent: '33%' };
    } else if (score <= 3) {
      return { label: 'Medium', color: '#f59e0b', percent: '66%' };
    } else {
      return { label: 'Strong', color: '#10b981', percent: '100%' };
    }
  }, [password]);

  const canSubmit =
    isNameValid &&
    isEmailValid &&
    isPasswordValid &&
    isConfirmValid &&
    termsAccepted &&
    !isLoading;

  const handleSubmit = () => {
    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
    });
    if (canSubmit) {
      onRegister(name.trim(), email.trim(), gender, password);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>
          {"Looks like you're new here! Set up your account and password to start shopping."}
        </Text>
      </View>

      {/* Verified Destination Pill */}
      <View style={styles.verifiedRow}>
        <View style={styles.verifiedLeft}>
          <Text style={styles.fieldLabel}>
            {mobile && mobile.includes('@') ? 'Verified Email' : 'Mobile Number'}
          </Text>
          <Text style={styles.verifiedMobileText}>
            {mobile && mobile.includes('@') ? mobile : `+91 ${mobile}`}
          </Text>
        </View>
        <View style={styles.verifiedBadge}>
          <Ionicons
            name="checkmark-circle"
            size={14}
            color={MyntraColors.ratingGreen}
          />
          <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
        </View>
      </View>

      {/* Full Name Input (Required) */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Full Name <Text style={styles.requiredStar}>*</Text>
        </Text>
        <TextInput
          style={[
            styles.input,
            focusedField === 'name' && styles.inputFocused,
            touched.name && !isNameValid ? styles.inputError : null,
          ]}
          placeholder="e.g. Rahul Sharma"
          placeholderTextColor={MyntraColors.textMuted}
          value={name}
          onChangeText={setName}
          onFocus={() => setFocusedField('name')}
          onBlur={() => {
            setFocusedField(null);
            setTouched((p) => ({ ...p, name: true }));
          }}
          autoCapitalize="words"
        />
        {touched.name && !isNameValid && (
          <Text style={styles.fieldErrorText}>
            Name is required (minimum 2 characters).
          </Text>
        )}
      </View>

      {/* Email Address Input (Required) */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Email Address <Text style={styles.requiredStar}>*</Text>
        </Text>
        <TextInput
          style={[
            styles.input,
            focusedField === 'email' && styles.inputFocused,
            touched.email && !isEmailValid ? styles.inputError : null,
          ]}
          placeholder="e.g. rahul.sharma@example.com"
          placeholderTextColor={MyntraColors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          onFocus={() => setFocusedField('email')}
          onBlur={() => {
            setFocusedField(null);
            setTouched((p) => ({ ...p, email: true }));
          }}
        />
        {touched.email && !isEmailValid && (
          <Text style={styles.fieldErrorText}>
            Please enter a valid email address.
          </Text>
        )}
      </View>

      {/* Password Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Create Password <Text style={styles.requiredStar}>*</Text>
        </Text>
        <View
          style={[
            styles.passwordRow,
            focusedField === 'password' && styles.inputFocused,
            touched.password && !isPasswordValid && styles.inputError,
          ]}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Min 6 characters"
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
          <Text style={styles.fieldErrorText}>
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
          <Text style={styles.fieldErrorText}>
            {confirmPassword.length === 0
              ? 'Please confirm your password.'
              : 'Passwords do not match.'}
          </Text>
        )}
      </View>

      {/* Gender Selection */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Select Gender</Text>
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

      {/* General Error Message */}
      {errorMessage && <Text style={styles.globalError}>{errorMessage}</Text>}

      {/* Submit Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={[
          styles.createButton,
          !canSubmit && styles.createButtonDisabled,
        ]}>
        {isLoading ? (
          <ActivityIndicator color={MyntraColors.white} size="small" />
        ) : (
          <Text style={styles.createButtonText}>CREATE ACCOUNT</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    backgroundColor: MyntraColors.white,
  },
  headerContainer: {
    marginBottom: Spacing.lg,
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
    lineHeight: 18,
  },
  verifiedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f6fdf9',
    borderWidth: 1,
    borderColor: '#c8e6c9',
    borderRadius: 8,
    padding: 12,
    marginBottom: Spacing.lg,
  },
  verifiedLeft: {
    gap: 2,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: MyntraColors.textSecondary,
    textTransform: 'uppercase',
  },
  verifiedMobileText: {
    fontSize: 14,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: MyntraColors.ratingGreen,
    letterSpacing: 0.5,
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
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fff5f5',
  },
  fieldErrorText: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 4,
    fontWeight: '500',
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
    marginBottom: Spacing.md,
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
  globalError: {
    fontSize: 12,
    color: '#ef4444',
    marginBottom: Spacing.md,
    fontWeight: '600',
  },
  createButton: {
    height: 48,
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
  createButtonDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
});
