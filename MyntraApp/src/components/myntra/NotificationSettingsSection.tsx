import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { pushNotificationService } from '@/services/push-notification-service';
import { storeService } from '@/services/store-service';
import { NotificationPreferences } from '@/types/store';

interface NotificationSettingsSectionProps {
  userId?: string;
  onPreferencesUpdated?: (prefs: NotificationPreferences) => void;
}

export const NotificationSettingsSection: React.FC<NotificationSettingsSectionProps> = ({
  userId,
  onPreferencesUpdated,
}) => {
  const { colors, isDark } = useTheme();

  const [preferences, setPreferences] = useState<NotificationPreferences>({
    pushNotificationsEnabled: true,
    devicePushEnabled: true,
    orderUpdates: true,
    paymentUpdates: true,
    wishlistPriceDrops: true,
    stockAlerts: true,
    promotions: true,
    cartReminders: true,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isPushToggling, setIsPushToggling] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(true);

  // Load user or guest preferences & permissions on mount or reopen
  useEffect(() => {
    let isMounted = true;
    const loadPreferences = async () => {
      setIsLoading(true);
      try {
        const [prefs, token, permStatus] = await Promise.all([
          storeService.fetchNotificationPreferences(),
          pushNotificationService.getStoredPushToken(),
          pushNotificationService.getPermissionStatus(),
        ]);
        if (isMounted) {
          setPreferences(prefs);
          setPushToken(token);
          setHasPermission(permStatus.granted);
        }
      } catch (e) {
        console.warn('Failed to load notification preferences:', e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadPreferences();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const isPushEnabled =
    preferences.pushNotificationsEnabled !== false &&
    preferences.devicePushEnabled !== false;

  // Requirement 4: Test Alert button readiness
  const isTestAlertReady = Boolean(
    isPushEnabled &&
    hasPermission &&
    (pushToken || Platform.OS === 'web')
  );

  // Requirement 4: Contextual helper message
  const getHelperMessage = (): { text: string; isWarning: boolean } => {
    if (!isPushEnabled) {
      return {
        text: 'Push notifications are turned OFF. Turn on Device Push Notifications above to test real-time alerts.',
        isWarning: true,
      };
    }
    if (!hasPermission && Platform.OS !== 'web') {
      return {
        text: 'Notification permission required. Please allow notifications in device settings to test alerts.',
        isWarning: true,
      };
    }
    if (!pushToken && Platform.OS !== 'web') {
      return {
        text: 'Push token setup in progress. Please toggle push notifications above to register device.',
        isWarning: true,
      };
    }
    return {
      text: 'Push delivery active. Tap Test Alert to dispatch a real-time notification.',
      isWarning: false,
    };
  };

  // Requirements 1, 2, 3, 6: Master Device Push ON/OFF Toggle
  const handleMasterPushToggle = async (targetValue: boolean) => {
    if (isPushToggling || isLoading) return;
    setIsPushToggling(true);

    if (targetValue) {
      // User is enabling push notifications
      try {
        const { token, granted } =
          await pushNotificationService.registerForPushNotificationsAsync();

        if (!granted && Platform.OS !== 'web') {
          setHasPermission(false);
          Alert.alert(
            'Permission Required',
            'Please enable notifications in your device settings to receive real-time push updates.'
          );
          setIsPushToggling(false);
          return;
        }

        setHasPermission(true);

        if (token) {
          setPushToken(token);
          const details = pushNotificationService.getDeviceDetails();
          await storeService.registerDeviceToken(token, details);
        }

        // Persist ON preference
        const updatedPrefs: NotificationPreferences = {
          ...preferences,
          pushNotificationsEnabled: true,
          devicePushEnabled: true,
        };
        setPreferences(updatedPrefs);
        if (onPreferencesUpdated) {
          onPreferencesUpdated(updatedPrefs);
        }

        const res = await storeService.updateNotificationPreferences({
          pushNotificationsEnabled: true,
          devicePushEnabled: true,
        });

        if (res) {
          setPreferences(res);
        }

        Alert.alert(
          'Push Notifications Active! 🔔',
          'Your device has been enabled for real-time notifications for orders, price drops, and deals.'
        );
      } catch (err: any) {
        console.error('Error enabling push notifications:', err);
        Alert.alert(
          'Push Notification Error',
          err?.message || 'Failed to enable push notifications. Please try again.'
        );
      } finally {
        setIsPushToggling(false);
      }
    } else {
      // User is disabling push notifications
      const prevPrefs = { ...preferences };
      const updatedPrefs: NotificationPreferences = {
        ...preferences,
        pushNotificationsEnabled: false,
        devicePushEnabled: false,
      };

      // Optimistic update
      setPreferences(updatedPrefs);
      if (onPreferencesUpdated) {
        onPreferencesUpdated(updatedPrefs);
      }

      try {
        const res = await storeService.updateNotificationPreferences({
          pushNotificationsEnabled: false,
          devicePushEnabled: false,
        });

        if (res) {
          setPreferences(res);
        }

        Alert.alert(
          'Push Notifications Disabled',
          'Device push notifications have been turned off. Optional alerts (deals, price drops, reminders) are paused.'
        );
      } catch (err: any) {
        console.error('Error disabling push notifications:', err);
        setPreferences(prevPrefs); // Rollback on API failure
        Alert.alert(
          'Update Failed',
          'Failed to save push notification preference to backend. Please try again.'
        );
      } finally {
        setIsPushToggling(false);
      }
    }
  };

  // Category toggle handler
  const handleToggle = async (key: keyof NotificationPreferences) => {
    const newValue = !preferences[key];
    const updated = { ...preferences, [key]: newValue };

    // Optimistic UI update
    setPreferences(updated);
    if (onPreferencesUpdated) {
      onPreferencesUpdated(updated);
    }

    try {
      await storeService.updateNotificationPreferences({ [key]: newValue });
    } catch (e) {
      console.warn(`Failed to update preference for ${key}:`, e);
    }
  };

  // Requirement 4: Send Test Notification
  const handleSendTest = async () => {
    if (!isTestAlertReady) {
      const helper = getHelperMessage();
      Alert.alert('Cannot Send Test Alert', helper.text);
      return;
    }

    setIsTesting(true);
    try {
      const testOrderId = `MYN-${Math.floor(100000 + Math.random() * 900000)}`;
      const testTitle = 'Order Confirmed! 🎉';
      const testBody = `Your order #${testOrderId} of ₹1,499 has been placed successfully and is being packed.`;

      // 1. Immediately trigger native mobile notification banner (heads-up banner on phone)
      await pushNotificationService.scheduleLocalNotification({
        title: testTitle,
        body: testBody,
        data: {
          orderId: testOrderId,
          screen: 'orders',
          category: 'order',
        },
        channelId: 'orders',
      });

      // 2. Dispatch to backend notification center
      await storeService.triggerTestNotification('order_confirmation', {
        orderId: testOrderId,
      });

      Alert.alert(
        'Test Notification Sent! 🚀',
        'A real-time notification banner was dispatched to your phone screen & Notification Center.'
      );
    } catch {
      Alert.alert('Error', 'Failed to dispatch test notification.');
    } finally {
      setIsTesting(false);
    }
  };

  const categories: {
    key: keyof NotificationPreferences;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
  }[] = [
    {
      key: 'orderUpdates',
      title: 'Order & Delivery Updates',
      description: 'Status changes: Order confirmed, packed, shipped, and delivered',
      icon: 'cube-outline',
      color: '#208aef',
    },
    {
      key: 'paymentUpdates',
      title: 'Payment Confirmations',
      description: 'Razorpay and UPI verified transaction alerts and payment receipts',
      icon: 'card-outline',
      color: '#5c6bc0',
    },
    {
      key: 'wishlistPriceDrops',
      title: 'Wishlist Price Drops',
      description: 'Timely alerts whenever prices drop on products in your wishlist',
      icon: 'heart-outline',
      color: '#ff3f6c',
    },
    {
      key: 'stockAlerts',
      title: 'Back-in-Stock Alerts',
      description: 'Get notified as soon as out-of-stock items become available again',
      icon: 'flash-outline',
      color: '#f59e0b',
    },
    {
      key: 'promotions',
      title: 'Exclusive Deals & Offers',
      description: 'Personalized insider discounts, coupon codes, and seasonal fashion sales',
      icon: 'pricetag-outline',
      color: '#8b5cf6',
    },
    {
      key: 'cartReminders',
      title: 'Bag & Cart Reminders',
      description: 'Helpful reminders about pending items in your shopping bag before they sell out',
      icon: 'bag-handle-outline',
      color: '#f97316',
    },
  ];

  const helper = getHelperMessage();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.cardBorder,
        },
      ]}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.headerIconCircle, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="notifications-outline" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              NOTIFICATION PREFERENCES
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Control real-time push alerts and category notifications
            </Text>
          </View>
        </View>
      </View>

      {/* Primary Master Push Notification Toggle Card (Requirements 1, 2, 3) */}
      <View
        style={[
          styles.masterPushCard,
          {
            backgroundColor: colors.surfaceSecondary,
            borderColor: isPushEnabled ? colors.cardBorder : colors.divider,
          },
        ]}>
        {/* Clickable Header Row: Tapping toggles Device Push */}
        <TouchableOpacity
          style={styles.masterPushTopRow}
          activeOpacity={0.8}
          onPress={() => handleMasterPushToggle(!isPushEnabled)}
          disabled={isLoading || isPushToggling}>
          <View
            style={[
              styles.masterIconCircle,
              {
                backgroundColor: isPushEnabled ? (isDark ? 'rgba(3,166,133,0.2)' : '#e6f9f3') : colors.inputBackground,
              },
            ]}>
            <Ionicons
              name={isPushEnabled ? 'notifications' : 'notifications-off-outline'}
              size={20}
              color={isPushEnabled ? colors.ratingGreen : colors.textSecondary}
            />
          </View>

          <View style={styles.masterTextCol}>
            <View style={styles.masterTitleRow}>
              <Text style={[styles.masterTitle, { color: colors.text }]}>
                Device Push Notifications
              </Text>
            </View>
            <Text style={[styles.masterDesc, { color: colors.textSecondary }]}>
              {isPushEnabled
                ? 'Active — alerts delivered directly to this device'
                : 'OFF — optional push notifications are paused'}
            </Text>
          </View>

          {/* Action Button & Switch Combo for explicit, easy clicking */}
          <View style={styles.actionControlsWrap}>
            {isPushToggling ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 6 }} />
            ) : (
              <TouchableOpacity
                style={[
                  styles.devicePushActionBtn,
                  isPushEnabled
                    ? {
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.cardBorder,
                      }
                    : {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      },
                ]}
                onPress={() => handleMasterPushToggle(!isPushEnabled)}
                activeOpacity={0.8}>
                <Ionicons
                  name={isPushEnabled ? 'power-outline' : 'notifications-outline'}
                  size={12}
                  color={isPushEnabled ? colors.textSecondary : colors.white}
                />
                <Text
                  style={[
                    styles.devicePushActionBtnText,
                    { color: isPushEnabled ? colors.text : colors.white },
                  ]}>
                  {isPushEnabled ? 'Turn OFF' : 'Turn ON'}
                </Text>
              </TouchableOpacity>
            )}

            <Switch
              value={isPushEnabled}
              onValueChange={handleMasterPushToggle}
              disabled={isLoading || isPushToggling}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={isPushEnabled ? colors.primary : colors.white}
              ios_backgroundColor={colors.border}
            />
          </View>
        </TouchableOpacity>

        {/* Status indicator badge & Test Alert Action Row */}
        <View style={styles.masterStatusRow}>
          <TouchableOpacity
            style={[
              styles.statusPill,
              {
                backgroundColor: !isPushEnabled
                  ? colors.inputBackground
                  : (isDark ? 'rgba(3,166,133,0.2)' : '#e6f9f3'),
              },
            ]}
            onPress={() => handleMasterPushToggle(!isPushEnabled)}
            activeOpacity={0.8}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: !isPushEnabled ? colors.textMuted : colors.ratingGreen,
                },
              ]}
            />
            <Text
              style={[
                styles.statusPillText,
                {
                  color: !isPushEnabled ? colors.textSecondary : colors.ratingGreen,
                },
              ]}>
              {!isPushEnabled ? '● Push Delivery Disabled' : '● Device Registered & Active'}
            </Text>
          </TouchableOpacity>

          {/* Test Alert Button (Requirement 4) */}
          <TouchableOpacity
            style={[
              styles.testBtn,
              isTestAlertReady
                ? {
                    borderColor: colors.primary,
                    backgroundColor: colors.primaryLight,
                    opacity: 1,
                  }
                : {
                    borderColor: colors.border,
                    backgroundColor: colors.inputBackground,
                    opacity: 0.6,
                  },
            ]}
            onPress={handleSendTest}
            disabled={!isTestAlertReady || isTesting}
            activeOpacity={0.75}>
            {isTesting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons
                  name="paper-plane-outline"
                  size={13}
                  color={isTestAlertReady ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.testBtnText,
                    { color: isTestAlertReady ? colors.primary : colors.textSecondary },
                  ]}>
                  Test Alert
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Helpful contextual message for Test Alert & Push State (Requirement 4) */}
        <View
          style={[
            styles.helperMsgBox,
            {
              backgroundColor: helper.isWarning
                ? (isDark ? 'rgba(245,158,11,0.15)' : '#fffbeb')
                : (isDark ? 'rgba(3,166,133,0.15)' : '#f0fdf4'),
              borderColor: helper.isWarning
                ? (isDark ? 'rgba(245,158,11,0.4)' : '#fde68a')
                : (isDark ? 'rgba(3,166,133,0.4)' : '#bbf7d0'),
            },
          ]}>
          <Ionicons
            name={helper.isWarning ? 'alert-circle-outline' : 'checkmark-circle-outline'}
            size={14}
            color={helper.isWarning ? colors.discountOrange : colors.ratingGreen}
            style={{ marginTop: 1 }}
          />
          <Text
            style={[
              styles.helperMsgText,
              {
                color: helper.isWarning
                  ? (isDark ? '#fef3c7' : '#92400e')
                  : (isDark ? '#dcfce7' : '#166534'),
              },
            ]}>
            {helper.text}
          </Text>
        </View>
      </View>

      {/* Category Toggles Header */}
      <View style={styles.catHeaderRow}>
        <Text style={[styles.catHeaderTitle, { color: colors.textSecondary }]}>
          NOTIFICATION CATEGORIES
        </Text>
      </View>

      {/* Category Toggles List */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading saved preferences...
          </Text>
        </View>
      ) : (
        <View style={styles.togglesList}>
          {categories.map((cat, idx) => {
            const isEnabled = Boolean(preferences[cat.key]);
            const isLast = idx === categories.length - 1;

            return (
              <View
                key={cat.key}
                style={[
                  styles.toggleRow,
                  !isLast && { borderBottomColor: colors.divider, borderBottomWidth: 0.8 },
                ]}>
                <View style={[styles.catIconWrap, { backgroundColor: `${cat.color}15` }]}>
                  <Ionicons name={cat.icon} size={18} color={cat.color} />
                </View>

                <View style={styles.toggleTextCol}>
                  <Text style={[styles.toggleTitle, { color: colors.text }]}>{cat.title}</Text>
                  <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>
                    {cat.description}
                  </Text>
                </View>

                <Switch
                  value={isEnabled}
                  onValueChange={() => handleToggle(cat.key)}
                  trackColor={{ false: colors.border, true: colors.primaryLight }}
                  thumbColor={isEnabled ? colors.primary : colors.white}
                  ios_backgroundColor={colors.border}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    padding: 14,
    paddingBottom: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  masterPushCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  masterPushTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  masterIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterTextCol: {
    flex: 1,
  },
  masterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  masterTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  masterDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  actionControlsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  devicePushActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  devicePushActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  masterStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusPillText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  testBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  helperMsgBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    padding: 8,
    borderRadius: 6,
    borderWidth: 0.8,
  },
  helperMsgText: {
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },
  catHeaderRow: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 4,
  },
  catHeaderTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  loadingBox: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 11,
  },
  togglesList: {
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  catIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTextCol: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  toggleDesc: {
    fontSize: 10.5,
    lineHeight: 14,
  },
});
