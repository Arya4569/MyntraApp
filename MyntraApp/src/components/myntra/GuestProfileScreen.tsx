import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { MyntraColors, Spacing } from '@/constants/myntra-theme';
import { useTheme } from '@/hooks/use-theme';

import { AppearanceSetting } from './AppearanceSetting';
import { HelpCenterModal } from './HelpCenterModal';
import { NotificationSettingsSection } from './NotificationSettingsSection';

interface GuestProfileScreenProps {
  onLoginPress: () => void;
  onSignUpPress?: () => void;
  onGoToWishlist: () => void;
  onGoToBag?: () => void;
  wishlistCount: number;
  bagCount?: number;
}

export const GuestProfileScreen: React.FC<GuestProfileScreenProps> = ({
  onLoginPress,
  onSignUpPress,
  onGoToWishlist,
  onGoToBag,
  wishlistCount,
  bagCount = 0,
}) => {
  const { colors, isDark } = useTheme();
  const [showHelpCenter, setShowHelpCenter] = React.useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = React.useState(false);
  const [showTerms, setShowTerms] = React.useState(false);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      {/* Top Guest Welcome Card */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: isDark ? colors.surfaceElevated : '#fff7f9',
            borderBottomColor: colors.cardBorder,
          },
        ]}>
        <View
          style={[
            styles.avatarCircle,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.cardBorder,
            },
          ]}>
          <Ionicons
            name="person-outline"
            size={36}
            color={colors.textSecondary}
          />
        </View>

        <Text style={[styles.welcomeTitle, { color: colors.text }]}>
          Welcome to Myntra
        </Text>
        <Text style={[styles.welcomeSub, { color: colors.textSecondary }]}>
          Log in to view your orders, saved addresses, wishlist, and exclusive
          insider rewards.
        </Text>

        {/* Primary Log In / Sign Up CTA Buttons */}
        <View style={styles.authButtonsRow}>
          <TouchableOpacity
            onPress={onLoginPress}
            style={styles.loginButton}
            activeOpacity={0.85}>
            <Text style={styles.loginButtonText}>LOG IN</Text>
          </TouchableOpacity>

          {onSignUpPress && (
            <TouchableOpacity
              onPress={onSignUpPress}
              style={[
                styles.signUpButton,
                { backgroundColor: colors.surface, borderColor: colors.primary },
              ]}
              activeOpacity={0.85}>
              <Text style={styles.signUpButtonText}>SIGN UP</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Benefits Highlights Strip */}
      <View
        style={[
          styles.benefitsRow,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.divider,
          },
        ]}>
        <View style={styles.benefitItem}>
          <Ionicons name="gift-outline" size={20} color={colors.primary} />
          <Text style={[styles.benefitTitle, { color: colors.text }]}>
            ₹500 OFF
          </Text>
          <Text style={[styles.benefitDesc, { color: colors.textSecondary }]}>
            On first order
          </Text>
        </View>

        <View
          style={[styles.benefitDivider, { backgroundColor: colors.divider }]}
        />

        <View style={styles.benefitItem}>
          <Ionicons name="cube-outline" size={20} color={colors.primary} />
          <Text style={[styles.benefitTitle, { color: colors.text }]}>
            Live Tracking
          </Text>
          <Text style={[styles.benefitDesc, { color: colors.textSecondary }]}>
            Easy order status
          </Text>
        </View>

        <View
          style={[styles.benefitDivider, { backgroundColor: colors.divider }]}
        />

        <View style={styles.benefitItem}>
          <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
          <Text style={[styles.benefitTitle, { color: colors.text }]}>
            Insider Club
          </Text>
          <Text style={[styles.benefitDesc, { color: colors.textSecondary }]}>
            VIP access & perks
          </Text>
        </View>
      </View>

      {/* Dynamic Theme & Appearance Selector */}
      <AppearanceSetting />

      {/* Notification Preferences (Persisted locally for guests, synced on login) */}
      <NotificationSettingsSection />

      {/* Menu Shortcuts */}
      <View
        style={[
          styles.menuContainer,
          {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            borderRadius: 12,
            paddingVertical: 4,
          },
        ]}>
        {/* Wishlist Shortcut */}
        <TouchableOpacity
          onPress={onGoToWishlist}
          style={[styles.menuRow, { borderBottomColor: colors.divider }]}
          activeOpacity={0.7}>
          <View
            style={[
              styles.menuIconCircle,
              { backgroundColor: colors.surfaceSecondary },
            ]}>
            <Ionicons name="heart-outline" size={18} color={colors.text} />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>Wishlist</Text>
            <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
              Your shortlisted styles
            </Text>
          </View>
          {wishlistCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{wishlistCount}</Text>
            </View>
          )}
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textMuted}
          />
        </TouchableOpacity>

        {/* Shopping Bag Shortcut */}
        {onGoToBag && (
          <TouchableOpacity
            onPress={onGoToBag}
            style={[styles.menuRow, { borderBottomColor: colors.divider }]}
            activeOpacity={0.7}>
            <View
              style={[
                styles.menuIconCircle,
                { backgroundColor: colors.surfaceSecondary },
              ]}>
              <Ionicons
                name="bag-handle-outline"
                size={18}
                color={colors.text}
              />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>
                Shopping Bag
              </Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
                Items saved in your bag
              </Text>
            </View>
            {bagCount > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{bagCount}</Text>
              </View>
            )}
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        )}

        {/* Orders Shortcut */}
        <TouchableOpacity
          onPress={onLoginPress}
          style={[styles.menuRow, { borderBottomColor: colors.divider }]}
          activeOpacity={0.7}>
          <View
            style={[
              styles.menuIconCircle,
              { backgroundColor: colors.surfaceSecondary },
            ]}>
            <Ionicons name="cube-outline" size={18} color={colors.text} />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>Orders</Text>
            <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
              Check order status & track packages
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textMuted}
          />
        </TouchableOpacity>

        {/* Help Center */}
        <TouchableOpacity
          onPress={() => setShowHelpCenter(true)}
          style={[styles.menuRow, { borderBottomColor: colors.divider }]}
          activeOpacity={0.7}>
          <View
            style={[
              styles.menuIconCircle,
              { backgroundColor: colors.surfaceSecondary },
            ]}>
            <Ionicons
              name="help-buoy-outline"
              size={18}
              color={colors.text}
            />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>
              Help Center
            </Text>
            <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
              24x7 customer support & FAQs
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textMuted}
          />
        </TouchableOpacity>

        {/* Terms of Use */}
        <TouchableOpacity
          onPress={() => setShowTerms(true)}
          style={[styles.menuRow, { borderBottomColor: colors.divider }]}
          activeOpacity={0.7}>
          <View
            style={[
              styles.menuIconCircle,
              { backgroundColor: colors.surfaceSecondary },
            ]}>
            <Ionicons
              name="document-text-outline"
              size={18}
              color={colors.text}
            />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>
              Terms of Use
            </Text>
            <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
              Usage guidelines & policies
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textMuted}
          />
        </TouchableOpacity>

        {/* Privacy Policy */}
        <TouchableOpacity
          onPress={() => setShowPrivacyPolicy(true)}
          style={[styles.menuRow, { borderBottomColor: colors.divider }]}
          activeOpacity={0.7}>
          <View
            style={[
              styles.menuIconCircle,
              { backgroundColor: colors.surfaceSecondary },
            ]}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={colors.text}
            />
          </View>
          <View style={styles.menuTextContainer}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>
              Privacy Policy
            </Text>
            <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
              How we safeguard your data
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* Help Center Modal */}
      <HelpCenterModal
        visible={showHelpCenter}
        onClose={() => setShowHelpCenter(false)}
      />

      {/* Terms of Use Modal */}
      {showTerms && (
        <View style={styles.modalOverlay}>
          <View style={styles.infoModalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Terms of Use</Text>
              <TouchableOpacity onPress={() => setShowTerms(false)}>
                <Ionicons name="close" size={22} color={MyntraColors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320, marginTop: 10 }}>
              <Text style={{ fontSize: 12, color: '#555', lineHeight: 18 }}>
                Welcome to Myntra. By browsing and using this app, you agree to comply with and be bound by the terms and conditions of use. All purchases, returns, and exchanges are subject to our standard 14-day hassle-free return policy.
              </Text>
              <Text style={{ fontSize: 12, color: '#555', lineHeight: 18, marginTop: 10 }}>
                Prices and availability of products are subject to change without prior notice. Promotional codes cannot be clubbed with certain excluded brand sales.
              </Text>
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowTerms(false)}
              style={styles.dismissBtn}>
              <Text style={styles.dismissBtnText}>I UNDERSTAND</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyPolicy && (
        <View style={styles.modalOverlay}>
          <View style={styles.infoModalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Privacy Policy</Text>
              <TouchableOpacity onPress={() => setShowPrivacyPolicy(false)}>
                <Ionicons name="close" size={22} color={MyntraColors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320, marginTop: 10 }}>
              <Text style={{ fontSize: 12, color: '#555', lineHeight: 18 }}>
                Your privacy is paramount to us. We store your account details, addresses, and wishlist securely. We do not sell your personal data to third parties.
              </Text>
              <Text style={{ fontSize: 12, color: '#555', lineHeight: 18, marginTop: 10 }}>
                You may request account or data deletion at any time via Help Center.
              </Text>
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowPrivacyPolicy(false)}
              style={styles.dismissBtn}>
              <Text style={styles.dismissBtnText}>I UNDERSTAND</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MyntraColors.white,
  },
  scrollContent: {
    paddingBottom: 90,
  },
  heroCard: {
    backgroundColor: '#fff7f9',
    padding: Spacing.xl,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#fbe2e8',
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f0f0f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: '#e2e2e6',
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  welcomeSub: {
    fontSize: 12,
    color: MyntraColors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 290,
  },
  authButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.lg,
  },
  loginButton: {
    backgroundColor: MyntraColors.primary,
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 6,
    shadowColor: MyntraColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButtonText: {
    color: MyntraColors.white,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  signUpButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: MyntraColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
  },
  signUpButtonText: {
    color: MyntraColors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  benefitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    backgroundColor: MyntraColors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f3',
  },
  benefitItem: {
    alignItems: 'center',
    flex: 1,
  },
  benefitTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: MyntraColors.text,
    marginTop: 4,
  },
  benefitDesc: {
    fontSize: 9.5,
    color: MyntraColors.textSecondary,
    marginTop: 1,
  },
  benefitDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#f0f0f3',
  },
  menuContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f3',
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MyntraColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: MyntraColors.text,
  },
  menuSubtitle: {
    fontSize: 11,
    color: MyntraColors.textSecondary,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: MyntraColors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 6,
  },
  countText: {
    color: MyntraColors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    zIndex: 1000,
  },
  infoModalCard: {
    backgroundColor: MyntraColors.white,
    borderRadius: 12,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f3',
    paddingBottom: 10,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: MyntraColors.text,
  },
  dismissBtn: {
    backgroundColor: MyntraColors.primary,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  dismissBtnText: {
    color: MyntraColors.white,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
