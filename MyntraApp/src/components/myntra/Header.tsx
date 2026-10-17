import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MyntraColors } from '@/constants/myntra-theme';

interface HeaderProps {
  wishlistCount: number;
  bagCount: number;
  isAuthenticated?: boolean;
  userName?: string;
  onPressProfile?: () => void;
  onPressWishlist?: () => void;
  onPressBag?: () => void;
  onPressSearch?: () => void;
  onPressLogo?: () => void;
  onPressInsider?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  wishlistCount,
  bagCount,
  isAuthenticated = false,
  userName,
  onPressProfile,
  onPressWishlist,
  onPressBag,
  onPressSearch,
  onPressLogo,
  onPressInsider,
}) => {
  return (
    <View style={styles.container}>
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
            <Text style={styles.brandTitle}>MYNTRA</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.insiderPill}
            onPress={onPressInsider}
            activeOpacity={0.7}
            accessibilityLabel="Myntra Insider VIP">
            <Text style={styles.insiderText}>INSIDER ✦</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Header Actions */}
      <View style={styles.actionsRow}>
        {/* Search Action Button */}
        {onPressSearch && (
          <TouchableOpacity
            accessibilityLabel="Search"
            style={styles.iconButton}
            onPress={onPressSearch}
            activeOpacity={0.7}>
            <Ionicons name="search-outline" size={21} color={MyntraColors.text} />
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
            <Ionicons name="person-outline" size={21} color={MyntraColors.text} />
          )}
        </TouchableOpacity>

        {/* Wishlist Button with Badge */}
        <TouchableOpacity
          accessibilityLabel="Wishlist"
          style={styles.iconButton}
          onPress={onPressWishlist}
          activeOpacity={0.7}>
          <Ionicons name="heart-outline" size={22} color={MyntraColors.text} />
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
          <Ionicons name="bag-handle-outline" size={21} color={MyntraColors.text} />
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
  badgeText: {
    color: MyntraColors.white,
    fontSize: 9,
    fontWeight: '700',
  },
});
