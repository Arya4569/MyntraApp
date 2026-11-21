import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { MyntraColors } from '@/constants/myntra-theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { storeService } from '@/services/store-service';
import { AppNotification, NotificationCategory } from '@/types/store';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToOrder?: (orderId: string) => void;
  onNavigateToProduct?: (productId: string) => void;
  onNavigateToBag?: () => void;
  onNavigateToOffers?: (couponCode?: string) => void;
  onUnreadCountChange?: (unreadCount: number) => void;
  onOpenAuth?: () => void;
  userId?: string;
}

type FilterCategoryKey = 'all' | 'orders' | 'offers' | 'wishlist' | 'cart';

const CATEGORY_TABS: { key: FilterCategoryKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'grid-outline' },
  { key: 'orders', label: 'Orders & Delivery', icon: 'cube-outline' },
  { key: 'offers', label: 'Offers & Promos', icon: 'pricetag-outline' },
  { key: 'wishlist', label: 'Wishlist & Stock', icon: 'heart-outline' },
  { key: 'cart', label: 'Bag Reminders', icon: 'bag-handle-outline' },
];

// Pure module-level relative timestamp formatter
const formatTimestamp = (dateStr: string): string => {
  try {
    const now = Date.now();
    const past = new Date(dateStr).getTime();
    const diffMs = Math.max(0, now - past);
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Date(dateStr).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Recently';
  }
};

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  visible,
  onClose,
  onNavigateToOrder,
  onNavigateToProduct,
  onNavigateToBag,
  onNavigateToOffers,
  onUnreadCountChange,
  onOpenAuth,
  userId,
}) => {
  const { user, isAuthenticated } = useAuth();
  const activeUserId = userId || user?.id;
  const { colors, isDark } = useTheme();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterCategoryKey>('all');
  const [unreadTotal, setUnreadTotal] = useState(0);

  const onUnreadCountChangeRef = React.useRef(onUnreadCountChange);
  React.useEffect(() => {
    onUnreadCountChangeRef.current = onUnreadCountChange;
  }, [onUnreadCountChange]);

  // Load notifications from backend API
  const loadNotifications = useCallback(
    async (isRefresh = false) => {
      if (!isAuthenticated || !activeUserId) {
        setNotifications([]);
        setUnreadTotal(0);
        setLoading(false);
        setRefreshing(false);
        onUnreadCountChangeRef.current?.(0);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const res = await storeService.fetchNotifications(1, 50, 'all');
        const userOnly = (res.notifications || []).filter(
          (n) => n.userId === activeUserId
        );
        setNotifications(userOnly);
        setUnreadTotal(res.unreadCount);
        onUnreadCountChangeRef.current?.(res.unreadCount);
      } catch (err: any) {
        console.warn('Failed to load notifications in modal:', err);
        setError('Unable to load notifications. Please check your connection.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAuthenticated, activeUserId]
  );

  useEffect(() => {
    if (!visible || !isAuthenticated || !activeUserId) {
      return;
    }

    let isMounted = true;
    storeService
      .fetchNotifications(1, 50, 'all')
      .then((res) => {
        if (isMounted) {
          const userOnly = (res.notifications || []).filter(
            (n) => n.userId === activeUserId
          );
          setNotifications(userOnly);
          setUnreadTotal(res.unreadCount);
          setLoading(false);
          onUnreadCountChangeRef.current?.(res.unreadCount);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('Failed to load notifications in modal:', err);
          setError('Unable to load notifications.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [visible, isAuthenticated, activeUserId]);

  // Mark single notification as read
  const handleMarkAsRead = async (item: AppNotification) => {
    if (item.read) return;

    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
    );
    const newCount = Math.max(0, unreadTotal - 1);
    setUnreadTotal(newCount);
    if (onUnreadCountChange) onUnreadCountChange(newCount);

    await storeService.markNotificationRead(item.id);
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    if (unreadTotal === 0) return;

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
    );
    setUnreadTotal(0);
    if (onUnreadCountChange) onUnreadCountChange(0);

    await storeService.markAllNotificationsRead();
  };

  // Delete notification
  const handleDeleteNotification = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (target && !target.read) {
      const newCount = Math.max(0, unreadTotal - 1);
      setUnreadTotal(newCount);
      if (onUnreadCountChange) onUnreadCountChange(newCount);
    }
    await storeService.deleteNotification(id);
  };

  // Handle tap on notification card for deep linking
  const handleNotificationPress = async (item: AppNotification) => {
    // 1. Mark as read
    handleMarkAsRead(item);

    // 2. Deep link based on category and data
    onClose();

    setTimeout(() => {
      if (item.category === 'order' || item.category === 'shipping' || item.category === 'payment') {
        const orderId = item.data?.orderId;
        if (orderId && onNavigateToOrder) {
          onNavigateToOrder(orderId);
        } else if (onNavigateToOrder) {
          onNavigateToOrder('');
        }
      } else if (item.category === 'wishlist' || item.category === 'stock') {
        const productId = item.data?.productId;
        if (productId && onNavigateToProduct) {
          onNavigateToProduct(productId);
        }
      } else if (item.category === 'cart') {
        if (onNavigateToBag) {
          onNavigateToBag();
        }
      } else if (item.category === 'promotion') {
        const coupon = item.data?.couponCode;
        if (onNavigateToOffers) {
          onNavigateToOffers(coupon);
        }
      }
    }, 250);
  };

  // Filter list by selected filter tab and strictly isolate to active user
  const filteredNotifications = useMemo(() => {
    if (!isAuthenticated || !activeUserId) return [];
    return notifications
      .filter((n) => n.userId === activeUserId)
      .filter((n) => {
        if (selectedFilter === 'all') return true;
        if (selectedFilter === 'orders') {
          return n.category === 'order' || n.category === 'shipping' || n.category === 'payment';
        }
        if (selectedFilter === 'offers') {
          return n.category === 'promotion';
        }
        if (selectedFilter === 'wishlist') {
          return n.category === 'wishlist' || n.category === 'stock';
        }
        if (selectedFilter === 'cart') {
          return n.category === 'cart';
        }
        return true;
      });
  }, [notifications, isAuthenticated, activeUserId, selectedFilter]);

  // Category Icon & Styling Helper
  const getCategoryMeta = (category: NotificationCategory) => {
    switch (category) {
      case 'order':
        return {
          icon: 'bag-check' as keyof typeof Ionicons.glyphMap,
          color: '#208aef',
          bgColor: '#e6f4fe',
          tag: 'ORDER',
          actionText: 'View Order →',
        };
      case 'shipping':
        return {
          icon: 'car' as keyof typeof Ionicons.glyphMap,
          color: '#03a685',
          bgColor: '#e6f9f5',
          tag: 'DELIVERY',
          actionText: 'Track Order →',
        };
      case 'payment':
        return {
          icon: 'card' as keyof typeof Ionicons.glyphMap,
          color: '#5c6bc0',
          bgColor: '#ede7f6',
          tag: 'PAYMENT',
          actionText: 'Payment Details →',
        };
      case 'wishlist':
        return {
          icon: 'heart' as keyof typeof Ionicons.glyphMap,
          color: '#ff3f6c',
          bgColor: '#fff0f3',
          tag: 'PRICE DROP',
          actionText: 'Shop Now →',
        };
      case 'stock':
        return {
          icon: 'flash' as keyof typeof Ionicons.glyphMap,
          color: '#f59e0b',
          bgColor: '#fef3c7',
          tag: 'RESTOCKED',
          actionText: 'Grab It Now →',
        };
      case 'promotion':
        return {
          icon: 'pricetag' as keyof typeof Ionicons.glyphMap,
          color: '#8b5cf6',
          bgColor: '#f3e8ff',
          tag: 'OFFER',
          actionText: 'Explore Offer →',
        };
      case 'cart':
        return {
          icon: 'cart' as keyof typeof Ionicons.glyphMap,
          color: '#f97316',
          bgColor: '#ffedd5',
          tag: 'BAG REMINDER',
          actionText: 'Checkout Bag →',
        };
      default:
        return {
          icon: 'notifications' as keyof typeof Ionicons.glyphMap,
          color: '#ff3f6c',
          bgColor: '#fff0f3',
          tag: 'UPDATE',
          actionText: 'View Details →',
        };
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.surface} />

        {/* 1. Header Bar */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.surface, borderBottomColor: colors.divider },
          ]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close Notifications">
              <Ionicons
                name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>NOTIFICATIONS</Text>
              {unreadTotal > 0 && (
                <View style={styles.unreadPill}>
                  <Text style={styles.unreadPillText}>{unreadTotal} NEW</Text>
                </View>
              )}
            </View>
          </View>

          {unreadTotal > 0 && (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              style={styles.markAllBtn}
              activeOpacity={0.7}
              accessibilityLabel="Mark all as read">
              <Text style={[styles.markAllText, { color: colors.primary }]}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 2. Category Filter Pills */}
        <View
          style={[
            styles.filterBar,
            { backgroundColor: colors.surface, borderBottomColor: colors.divider },
          ]}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={CATEGORY_TABS}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.filterScroll}
            renderItem={({ item }) => {
              const isSelected = selectedFilter === item.key;
              return (
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isSelected
                        ? colors.primary
                        : isDark
                        ? colors.surfaceSecondary
                        : '#f5f5f6',
                      borderColor: isSelected ? colors.primary : colors.cardBorder,
                    },
                  ]}
                  onPress={() => setSelectedFilter(item.key)}
                  activeOpacity={0.7}>
                  <Ionicons
                    name={item.icon}
                    size={14}
                    color={isSelected ? MyntraColors.white : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color: isSelected ? MyntraColors.white : colors.text,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* 3. Main Content List */}
        {loading && !refreshing ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading notifications...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Ionicons name="cloud-offline-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.errorTitle, { color: colors.text }]}>Oops!</Text>
            <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              onPress={() => loadNotifications()}
              activeOpacity={0.8}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredNotifications.length === 0 ? (
          <View style={styles.centerBox}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: isDark ? colors.surfaceSecondary : '#fff0f3' },
              ]}>
              <Ionicons name="notifications-outline" size={42} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {!isAuthenticated ? 'Log In to View Notifications' : 'No Notifications Yet'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {!isAuthenticated
                ? 'Sign in to access your personal order updates, delivery tracking, and exclusive fashion alerts.'
                : selectedFilter === 'all'
                ? "We'll notify you when there are updates on your orders, wishlist price drops, and exclusive offers!"
                : `No notifications in ${selectedFilter} right now.`}
            </Text>
            {!isAuthenticated && onOpenAuth && (
              <TouchableOpacity
                style={[styles.emptyLoginBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  onClose();
                  onOpenAuth();
                }}
                activeOpacity={0.85}>
                <Text style={styles.emptyLoginBtnText}>LOGIN / SIGN UP</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredNotifications}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadNotifications(true)}
                colors={[MyntraColors.primary]}
                tintColor={MyntraColors.primary}
              />
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const meta = getCategoryMeta(item.category);
              const isUnread = !item.read;

              return (
                <TouchableOpacity
                  style={[
                    styles.notifCard,
                    {
                      backgroundColor: isUnread
                        ? isDark
                          ? '#2a1b24'
                          : '#fff7f9'
                        : colors.surface,
                      borderColor: isUnread ? '#ffd8e2' : colors.cardBorder,
                    },
                  ]}
                  onPress={() => handleNotificationPress(item)}
                  activeOpacity={0.85}>
                  {/* Category icon */}
                  <View style={[styles.categoryIconWrap, { backgroundColor: meta.bgColor }]}>
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                  </View>

                  {/* Body Content */}
                  <View style={styles.notifBody}>
                    <View style={styles.notifTopRow}>
                      <View style={styles.tagRow}>
                        <View style={[styles.categoryBadge, { backgroundColor: meta.bgColor }]}>
                          <Text style={[styles.categoryBadgeText, { color: meta.color }]}>
                            {meta.tag}
                          </Text>
                        </View>
                        {isUnread && (
                          <View style={styles.newDot}>
                            <Text style={styles.newDotText}>NEW</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.timestampText, { color: colors.textSecondary }]}>
                        {formatTimestamp(item.createdAt)}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.notifTitle,
                        { color: colors.text, fontWeight: isUnread ? '800' : '600' },
                      ]}
                      numberOfLines={2}>
                      {item.title}
                    </Text>

                    <Text
                      style={[styles.notifMessage, { color: colors.textSecondary }]}
                      numberOfLines={3}>
                      {item.message}
                    </Text>

                    {/* Action Row */}
                    <View style={styles.notifFooterRow}>
                      <Text style={[styles.actionLinkText, { color: colors.primary }]}>
                        {meta.actionText}
                      </Text>

                      <View style={styles.actionButtons}>
                        {isUnread && (
                          <TouchableOpacity
                            onPress={() => handleMarkAsRead(item)}
                            style={styles.actionIconBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel="Mark read">
                            <Ionicons name="checkmark-done" size={17} color={colors.primary} />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => handleDeleteNotification(item.id)}
                          style={styles.actionIconBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityLabel="Delete notification">
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color={colors.textSecondary}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  unreadPill: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadPillText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  markAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterBar: {
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    justifyContent: 'center',
  },
  filterScroll: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 0.8,
  },
  filterChipText: {
    fontSize: 12,
  },
  listContent: {
    padding: 12,
    gap: 10,
  },
  notifCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1.5,
  },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifBody: {
    flex: 1,
  },
  notifTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  newDot: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  newDotText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '800',
  },
  timestampText: {
    fontSize: 10.5,
  },
  notifTitle: {
    fontSize: 13.5,
    lineHeight: 18,
    marginBottom: 3,
  },
  notifMessage: {
    fontSize: 12,
    lineHeight: 16.5,
    marginBottom: 8,
  },
  notifFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  actionLinkText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIconBtn: {
    padding: 2,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 6,
  },
  retryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyLoginBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLoginBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
