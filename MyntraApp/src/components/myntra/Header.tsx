import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { MyntraColors } from '@/constants/myntra-theme';
import { useTheme } from '@/hooks/use-theme';

interface HeaderProps {
  wishlistCount: number;
  bagCount: number;
  notificationCount?: number;
  isAuthenticated?: boolean;
  userName?: string;
  onPressProfile?: () => void;
  onPressWishlist?: () => void;
  onPressBag?: () => void;
  onPressNotifications?: () => void;
  onPressSearch?: () => void;
  onPressLogo?: () => void;
  onPressInsider?: () => void;
  activeTab?: string;
  onSelectTab?: (tab: 'home' | 'categories' | 'wishlist' | 'profile') => void;
}

export const Header: React.FC<HeaderProps> = ({
  wishlistCount,
  bagCount,
  notificationCount = 0,
  isAuthenticated = false,
  userName,
  onPressProfile,
  onPressWishlist,
  onPressBag,
  onPressNotifications,
  onPressSearch,
  onPressLogo,
  onPressInsider,
  activeTab = 'home',
  onSelectTab,
}) => {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.divider,
          height: isDesktop ? 64 : 56,
          paddingHorizontal: isDesktop ? 24 : 12,
        },
      ]}>
      {/* Brand Logo & Name */}
      <View style={styles.brandRow}>
        <TouchableOpacity
          style={styles.logoBadge}
          onPress={onPressLogo}
          activeOpacity={0.8}
          accessibilityLabel="Myntra Home">
          <Text style={styles.logoLetter}>M</Text>
        </TouchableOpacity>
        <View style={styles.brandTextContainer}>
          <TouchableOpacity
            onPress={onPressLogo}
            activeOpacity={0.8}
            accessibilityLabel="Myntra Brand">
            <Text style={[styles.brandTitle, { color: colors.text }]}>MYNTRA</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.insiderPill,
              { backgroundColor: isDark ? colors.surfaceSecondary : '#f5f5f6' },
            ]}
            onPress={onPressInsider}
            activeOpacity={0.7}
            accessibilityLabel="Myntra Insider VIP">
            <Text style={[styles.insiderText, { color: colors.textSecondary }]}>
              INSIDER ✦
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Desktop Navigation Links (Only visible on web / desktop screens) */}
      {isDesktop && onSelectTab && (
        <View style={styles.desktopNavRow}>
          <TouchableOpacity
            style={[styles.desktopNavItem, activeTab === 'home' && styles.desktopNavItemActive]}
            onPress={() => onSelectTab('home')}
            activeOpacity={0.8}>
            <Text
              style={[
                styles.desktopNavText,
                { color: activeTab === 'home' ? colors.primary : colors.text },
              ]}>
              HOME
            </Text>
            {activeTab === 'home' && (
              <View style={[styles.desktopNavUnderline, { backgroundColor: colors.primary }]} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.desktopNavItem, activeTab === 'categories' && styles.desktopNavItemActive]}
            onPress={() => onSelectTab('categories')}
            activeOpacity={0.8}>
            <Text
              style={[
                styles.desktopNavText,
                { color: activeTab === 'categories' ? colors.primary : colors.text },
              ]}>
              CATEGORIES
            </Text>
            {activeTab === 'categories' && (
              <View style={[styles.desktopNavUnderline, { backgroundColor: colors.primary }]} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.desktopNavItem, activeTab === 'wishlist' && styles.desktopNavItemActive]}
            onPress={() => onSelectTab('wishlist')}
            activeOpacity={0.8}>
            <Text
              style={[
                styles.desktopNavText,
                { color: activeTab === 'wishlist' ? colors.primary : colors.text },
              ]}>
              WISHLIST
            </Text>
            {wishlistCount > 0 && (
              <View style={styles.desktopNavBadge}>
                <Text style={styles.desktopNavBadgeText}>{wishlistCount}</Text>
              </View>
            )}
            {activeTab === 'wishlist' && (
              <View style={[styles.desktopNavUnderline, { backgroundColor: colors.primary }]} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.desktopNavItem, activeTab === 'profile' && styles.desktopNavItemActive]}
            onPress={() => onSelectTab('profile')}
            activeOpacity={0.8}>
            <Text
              style={[
                styles.desktopNavText,
                { color: activeTab === 'profile' ? colors.primary : colors.text },
              ]}>
              {isAuthenticated && userName ? userName.split(' ')[0].toUpperCase() : 'PROFILE'}
            </Text>
            {activeTab === 'profile' && (
              <View style={[styles.desktopNavUnderline, { backgroundColor: colors.primary }]} />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Header Actions */}
      <View style={styles.actionsRow}>
        {/* Search Action Button */}
        {onPressSearch && (
          <TouchableOpacity
            accessibilityLabel="Search"
            style={styles.iconButton}
            onPress={onPressSearch}
            activeOpacity={0.7}>
            <Ionicons name="search-outline" size={21} color={colors.text} />
          </TouchableOpacity>
        )}

        {/* Profile Button - Shows user initial if logged in */}
        <TouchableOpacity
          accessibilityLabel="Profile"
          style={styles.iconButton}
          onPress={onPressProfile}
          activeOpacity={0.7}>
          {isAuthenticated && userName ? (
            <View style={styles.userAvatarCircle}>
              <Text style={styles.userAvatarText}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          ) : (
            <Ionicons name="person-outline" size={21} color={colors.text} />
          )}
        </TouchableOpacity>

        {/* Notifications Bell Button with Unread Badge */}
        {onPressNotifications && (
          <TouchableOpacity
            accessibilityLabel="Notifications"
            style={styles.iconButton}
            onPress={onPressNotifications}
            activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {notificationCount > 0 && (
              <View style={[styles.badge, styles.notifBadge]}>
                <Text style={styles.badgeText}>
                  {notificationCount > 99 ? '99+' : notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Wishlist Button with Badge */}
        <TouchableOpacity
          accessibilityLabel="Wishlist"
          style={styles.iconButton}
          onPress={onPressWishlist}
          activeOpacity={0.7}>
          <Ionicons name="heart-outline" size={22} color={colors.text} />
          {wishlistCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {wishlistCount > 99 ? '99+' : wishlistCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Bag Button with Badge */}
        <TouchableOpacity
          accessibilityLabel="Shopping Bag"
          style={[styles.iconButton, styles.bagIconButton]}
          onPress={onPressBag}
          activeOpacity={0.7}>
          <Ionicons name="bag-handle-outline" size={22} color={colors.text} />
          {bagCount > 0 && (
            <View style={[styles.badge, styles.bagBadge]}>
              <Text style={styles.badgeText}>
                {bagCount > 99 ? '99+' : bagCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 12,
    paddingRight: 10,
    backgroundColor: MyntraColors.white,
    borderBottomWidth: 1,
    borderBottomColor: MyntraColors.divider,
    overflow: 'visible',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  logoBadge: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: MyntraColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: MyntraColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  logoLetter: {
    color: MyntraColors.white,
    fontSize: 18,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -1,
  },
  brandTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: MyntraColors.text,
    letterSpacing: 1.2,
  },
  insiderPill: {
    backgroundColor: '#fff0f3',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#ffc1cf',
  },
  insiderText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: MyntraColors.primary,
    letterSpacing: 0.3,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderRadius: 18,
  },
  bagIconButton: {
    marginRight: 2,
  },
  userAvatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: MyntraColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: MyntraColors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    top: 1,
    right: 1,
    backgroundColor: MyntraColors.primary,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: MyntraColors.white,
  },
  bagBadge: {
    backgroundColor: '#ff3f6c',
  },
  notifBadge: {
    backgroundColor: '#ff3f6c',
  },
  badgeText: {
    color: MyntraColors.white,
    fontSize: 9,
    fontWeight: '700',
  },
  desktopNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
    marginHorizontal: 24,
  },
  desktopNavItem: {
    paddingVertical: 20,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  desktopNavItemActive: {},
  desktopNavText: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  desktopNavUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  desktopNavBadge: {
    backgroundColor: '#ff3f6c',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 3,
  },
  desktopNavBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800',
  },
});
