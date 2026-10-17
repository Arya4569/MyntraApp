import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MyntraColors } from '@/constants/myntra-theme';

export type TabKey = 'home' | 'categories' | 'wishlist' | 'profile';

interface BottomNavProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  wishlistCount: number;
  bagCount?: number;
  onPressBag?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  wishlistCount,
  bagCount = 0,
  onPressBag,
}) => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 6);

  const tabs: {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon: keyof typeof Ionicons.glyphMap;
    showBadge?: boolean;
    badgeCount?: number;
    customPress?: () => void;
  }[] = [
    {
      key: 'home',
      label: 'Home',
      icon: 'home-outline',
      activeIcon: 'home',
    },
    {
      key: 'categories',
      label: 'Categories',
      icon: 'grid-outline',
      activeIcon: 'grid',
    },
    {
      key: 'wishlist',
      label: 'Wishlist',
      icon: 'heart-outline',
      activeIcon: 'heart',
      showBadge: wishlistCount > 0,
      badgeCount: wishlistCount,
    },
    ...(onPressBag
      ? [
          {
            key: 'bag',
            label: 'Bag',
            icon: 'bag-handle-outline' as keyof typeof Ionicons.glyphMap,
            activeIcon: 'bag-handle' as keyof typeof Ionicons.glyphMap,
            showBadge: bagCount > 0,
            badgeCount: bagCount,
            customPress: onPressBag,
          },
        ]
      : []),
    {
      key: 'profile',
      label: 'Profile',
      icon: 'person-outline',
      activeIcon: 'person',
    },
  ];

  return (
    <View style={[styles.outerContainer, { paddingBottom: bottomPadding }]}>
      <View style={styles.navRow}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const iconName = isActive ? tab.activeIcon : tab.icon;
          const color = isActive ? MyntraColors.primary : MyntraColors.textSecondary;

          return (
            <TouchableOpacity
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              onPress={() => {
                if (tab.customPress) {
                  tab.customPress();
                } else {
                  onSelectTab(tab.key as TabKey);
                }
              }}
              activeOpacity={0.7}
              style={styles.tabButton}>
              <View style={styles.iconContainer}>
                <Ionicons name={iconName} size={21} color={color} />
                {tab.showBadge && tab.badgeCount && tab.badgeCount > 0 ? (
                  <View style={styles.navBadge}>
                    <Text style={styles.navBadgeText}>
                      {tab.badgeCount > 99 ? '99+' : tab.badgeCount}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: MyntraColors.white,
    borderTopWidth: 1,
    borderTopColor: '#eaeaec',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    alignSelf: 'center',
    width: '100%',
  },
  navRow: {
    flexDirection: 'row',
    height: 50,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  iconContainer: {
    position: 'relative',
    width: 26,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: MyntraColors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: MyntraColors.primary,
    fontWeight: '800',
  },
  navBadge: {
    position: 'absolute',
    top: -2,
    right: -7,
    backgroundColor: MyntraColors.primary,
    minWidth: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: MyntraColors.white,
  },
  navBadgeText: {
    color: MyntraColors.white,
    fontSize: 8,
    fontWeight: '800',
  },
});
