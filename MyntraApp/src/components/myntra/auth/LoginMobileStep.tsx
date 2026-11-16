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

interface LoginMobileStepProps {
  onContinue: (mobile: string) => Promise<void>;
  isLoading: boolean;
  errorMessage?: string;
  isLiveProvider?: boolean;
  onSwitchToSignUp?: () => void;
  onSwitchToPasswordLogin?: () => void;
  mode?: 'login' | 'signup';
}

export const LoginMobileStep: React.FC<LoginMobileStepProps> = ({
  onContinue,
  isLoading,
  errorMessage,
  onSwitchToSignUp,
  onSwitchToPasswordLogin,
  mode = 'signup',
}) => {
  const [email, setEmail] = useState('');
  const [inputTouched, setInputTouched] = useState(false);
  const [showHelpAlert, setShowHelpAlert] = useState(false);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isValidInput = isValidEmail;

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (!inputTouched && text.length > 0) {
      setInputTouched(true);
    }
  };

  const handleSubmit = () => {
    if (isValidInput && !isLoading) {
      onContinue(email.trim().toLowerCase());
    }
  };

  const showValidationError = inputTouched && email.length > 0 && !isValidEmail;

  return (
    <View style={styles.container}>
      {/* Top Fashion Promotional Banner */}
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
          <Text style={styles.bannerTitle}>Unlock Exclusive Offers</Text>
          <Text style={styles.bannerSub}>Special Offers on your first order</Text>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.formContainer}>
        <View style={styles.headingRow}>
          {mode === 'signup' ? (
            <Text style={styles.title}>Sign Up with OTP</Text>
          ) : (
            <>
              <Text style={styles.title}>Login</Text>
              <Text style={styles.orText}>or</Text>
              <Text style={styles.title}>Signup</Text>
            </>
          )}
        </View>

        <Text style={styles.inputGuideSubtitle}>
          {mode === 'signup'
            ? 'Enter your Email to verify with OTP and create your account'
            : 'Enter your registered Email to receive a verification OTP'}
        </Text>

        {/* Clean Email Input Field */}
        <View style={styles.inputWrapper}>
          <View style={styles.inputIconPill}>
            <Ionicons
              name="mail-outline"
              size={18}
              color={MyntraColors.textSecondary}
            />
            <View style={styles.codeDivider} />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Enter your Email *"
            placeholderTextColor={MyntraColors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={handleEmailChange}
            autoFocus
          />

          {email.length > 3 && (
            <Ionicons
              name={isValidEmail ? 'checkmark-circle' : 'alert-circle'}
              size={20}
              color={isValidEmail ? MyntraColors.ratingGreen : '#e53935'}
            />
          )}
        </View>

        {/* Validation Error Message */}
        {showValidationError && (
          <Text style={styles.errorText}>
            Please enter a valid email address (e.g. name@gmail.com).
          </Text>
        )}

        {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        {/* Terms and Privacy Text */}
        <Text style={styles.termsText}>
          By continuing, I agree to the{' '}
          <Text style={styles.termsLink}>Terms of Use</Text> &{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>

        {/* Continue Primary Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={!isValidInput || isLoading}
          style={[
            styles.continueButton,
            (!isValidInput || isLoading) && styles.continueButtonDisabled,
          ]}>
          {isLoading ? (
            <ActivityIndicator color={MyntraColors.white} size="small" />
          ) : (
            <Text style={styles.continueButtonText}>CONTINUE</Text>
          )}
        </TouchableOpacity>

        {/* Authentic Myntra: Have trouble logging in? Get help */}
        <View style={styles.helpContainer}>
          <Text style={styles.helpText}>Have trouble logging in? </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowHelpAlert(!showHelpAlert)}>
            <Text style={styles.helpLink}>Get help</Text>
          </TouchableOpacity>
        </View>

        {showHelpAlert && (
          <View style={styles.helpBox}>
            <View style={styles.helpBoxHeader}>
              <Ionicons name="help-circle-outline" size={16} color={MyntraColors.primary} />
              <Text style={styles.helpBoxTitle}>Myntra 24x7 Helpdesk</Text>
            </View>
            <Text style={styles.helpBoxDesc}>
              Make sure your mobile number is active to receive SMS OTP. If you do not receive an OTP within 30 seconds, you can tap Resend OTP or reach support at support@myntra.com.
            </Text>
          </View>
        )}

        {/* Divider */}
        <View style={styles.orDividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.orDividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Alternative Actions: Password Login & Direct Sign Up */}
        <View style={styles.altActionsContainer}>
          {onSwitchToPasswordLogin && (
            <TouchableOpacity
              onPress={onSwitchToPasswordLogin}
              style={styles.altBtn}
              activeOpacity={0.7}
              disabled={isLoading}>
              <Ionicons name="key-outline" size={16} color={MyntraColors.text} />
              <Text style={styles.altBtnText}>Log in with Password</Text>
            </TouchableOpacity>
          )}

          {onSwitchToSignUp && (
            <TouchableOpacity
              onPress={onSwitchToSignUp}
              style={styles.signUpBtn}
              activeOpacity={0.7}
              disabled={isLoading}>
              <Text style={styles.signUpBtnText}>
                New to Myntra? <Text style={styles.signUpHighlight}>Create Account</Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MyntraColors.white,
  },
  bannerContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
    backgroundColor: '#1d1323',
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    opacity: 0.55,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFill,
    padding: Spacing.lg,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(29, 19, 35, 0.45)',
  },
  discountTag: {
    backgroundColor: MyntraColors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6,
  },
  discountTagText: {
    color: MyntraColors.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bannerTitle: {
    color: MyntraColors.white,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bannerSub: {
    color: '#ffc1cf',
    fontSize: 12,
    marginTop: 2,
  },
  formContainer: {
    padding: Spacing.xl,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  orText: {
    fontSize: 14,
    color: MyntraColors.textSecondary,
    fontWeight: '500',
  },
  inputGuideSubtitle: {
    fontSize: 12.5,
    color: MyntraColors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#d4d5d9',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 50,
    backgroundColor: MyntraColors.white,
  },
  countryCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: MyntraColors.text,
  },
  codeDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#d4d5d9',
    marginHorizontal: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: MyntraColors.text,
    letterSpacing: 1,
    fontWeight: '600',
    outlineStyle: 'none' as any,
  },
  errorText: {
    color: '#e53935',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '500',
  },
  termsText: {
    fontSize: 11.5,
    color: MyntraColors.textSecondary,
    marginTop: 20,
    lineHeight: 17,
  },
  termsLink: {
    color: MyntraColors.primary,
    fontWeight: '700',
  },
  continueButton: {
    backgroundColor: MyntraColors.primary,
    height: 48,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: MyntraColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  continueButtonDisabled: {
    backgroundColor: '#f4b0c1',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    color: MyntraColors.white,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  helpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  helpText: {
    fontSize: 12,
    color: MyntraColors.textSecondary,
    fontWeight: '500',
  },
  helpLink: {
    fontSize: 12,
    color: MyntraColors.primary,
    fontWeight: '700',
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
  orDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  orDividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: MyntraColors.textMuted,
  },
  altActionsContainer: {
    gap: 12,
  },
  altBtn: {
    height: 44,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fafafa',
  },
  altBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: MyntraColors.text,
  },
  signUpBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  signUpBtnText: {
    fontSize: 13,
    color: MyntraColors.textSecondary,
  },
  signUpHighlight: {
    color: MyntraColors.primary,
    fontWeight: '800',
  },
  methodToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f6',
    borderRadius: 8,
    padding: 3,
    marginBottom: 16,
    gap: 4,
  },
  methodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  methodTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  methodTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: MyntraColors.textSecondary,
  },
  methodTabTextActive: {
    color: MyntraColors.primary,
    fontWeight: '700',
  },
  inputIconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 6,
  },
});
