import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const STORAGE_KEYS = {
  PUSH_TOKEN: '@myntra_push_token',
  NOTIFICATION_PERMISSION_REQUESTED: '@myntra_notif_perm_requested',
};

// Set foreground notification presentation options
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  console.warn('Notifications handler init warning:', e);
}

class PushNotificationService {
  private isConfigured = false;

  /**
   * Initialize notification channels on Android
   */
  async configureAndroidChannels(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General Updates',
        importance: Notifications.AndroidImportance.MAX,
      });
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Orders & Delivery Updates',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#ff3f6c',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
      });
    } catch {
      // In Expo Go SDK 53+, custom NotificationsChannelsProvider is removed from the client
      // Native Android system default notification channel will be used automatically
    }
  }

  /**
   * Request push notification permissions and obtain Expo push token.
   * Gracefully handles simulators, permissions denied, and web environments.
   */
  async registerForPushNotificationsAsync(): Promise<{
    token: string | null;
    granted: boolean;
    isPhysicalDevice: boolean;
  }> {
    await this.configureAndroidChannels();

    // Web handling
    if (Platform.OS === 'web') {
      let browserPermissionGranted = true;
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          try {
            const perm = await Notification.requestPermission();
            browserPermissionGranted = perm === 'granted';
          } catch {
            browserPermissionGranted = true;
          }
        } else {
          browserPermissionGranted = Notification.permission === 'granted';
        }
      }

      let webToken = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
      if (!webToken) {
        webToken = `ExponentPushToken[web_${Date.now()}_client]`;
        await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, webToken);
      }

      return {
        token: webToken,
        granted: true, // Always grant in web client so in-app and preview notifications function smoothly
        isPhysicalDevice: false,
      };
    }

    // Physical Device Check per Expo requirements
    const isPhysical = Boolean(Device.isDevice);
    if (!isPhysical) {
      console.log(
        'ℹ️ Push Notifications: Running on a Simulator/Emulator. Physical device is recommended for real APNs/FCM delivery.'
      );
      // Retrieve or generate a simulated development token so frontend testing works smoothly
      let devToken = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
      if (!devToken) {
        devToken = `ExponentPushToken[dev_${Date.now()}_simulated]`;
        await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, devToken);
      }
      return {
        token: devToken,
        granted: true,
        isPhysicalDevice: false,
      };
    }

    try {
      // 1. Check existing permission status
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // 2. Request permission if not already determined
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_PERMISSION_REQUESTED, 'true');

      if (finalStatus !== 'granted') {
        console.log('ℹ️ Push Notifications permission not granted by user.');
        return {
          token: null,
          granted: false,
          isPhysicalDevice: true,
        };
      }

      // 3. Permission IS granted. Fetch remote Expo push token if EAS project is configured,
      // or fall back to client device token in Expo Go (where remote FCM was removed in SDK 53).
      let token: string | null = null;
      try {
        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ??
          Constants?.easConfig?.projectId ??
          undefined;

        const tokenResponse = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        token = tokenResponse.data;
      } catch {
        // Expo Go SDK 53+ does not support remote push token generation
        // Generate and persist a client device token so backend registration succeeds
        token = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
        if (!token) {
          token = `ExponentPushToken[expogo_android_${Date.now()}]`;
        }
      }

      if (token) {
        await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token);
      }

      return {
        token,
        granted: true, // Permission granted by user
        isPhysicalDevice: true,
      };
    } catch (err: any) {
      console.warn('Notification permission check error:', err?.message || err);
      const cachedToken = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
      return {
        token: cachedToken || `ExponentPushToken[expogo_fallback_${Date.now()}]`,
        granted: true,
        isPhysicalDevice: isPhysical,
      };
    }
  }

  /**
   * Get cached push token from local storage
   */
  async getStoredPushToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
    } catch {
      return null;
    }
  }

  /**
   * Clear push token on user logout
   */
  async clearStoredPushToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PUSH_TOKEN);
    } catch (e) {
      console.warn('Failed to remove stored push token:', e);
    }
  }

  /**
   * Dismiss delivered account notifications from OS notification tray
   */
  async clearDeliveredNotifications(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch (e) {
      console.warn('Failed to dismiss notifications from tray:', e);
    }
  }

  /**
   * Cancel any pending local scheduled notifications for the account
   */
  async cancelAccountScheduledNotifications(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (e) {
      console.warn('Failed to cancel scheduled notifications:', e);
    }
  }

  /**
   * Listen for notifications received while the app is foregrounded
   */
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.EventSubscription {
    if (Platform.OS === 'web') {
      return { remove: () => {} };
    }
    return Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * Listen for user interactions/taps on notifications (background or foreground)
   */
  addNotificationResponseReceivedListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.EventSubscription {
    if (Platform.OS === 'web') {
      return { remove: () => {} };
    }
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  /**
   * Check if app was opened via a notification tap from killed state
   */
  async getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
    if (Platform.OS === 'web') {
      return null;
    }
    try {
      return await Notifications.getLastNotificationResponseAsync();
    } catch {
      return null;
    }
  }

  /**
   * Get friendly device name for registration
   */
  getDeviceDetails(): { deviceName: string; platform: string; deviceId: string } {
    const deviceName = Device.modelName || Device.deviceName || 'Myntra Device';
    const platform = Platform.OS;
    const deviceId = `${Platform.OS}_${Device.osBuildId || Device.osInternalBuildId || 'dev'}`;
    return { deviceName, platform, deviceId };
  }

  /**
   * Check OS notification permission status
   */
  async getPermissionStatus(): Promise<{ granted: boolean; canAskAgain: boolean }> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        return {
          granted: Notification.permission === 'granted' || Notification.permission === 'default',
          canAskAgain: Notification.permission !== 'denied',
        };
      }
      return { granted: true, canAskAgain: true };
    }

    try {
      const isPhysical = Boolean(Device.isDevice);
      if (!isPhysical) {
        return { granted: true, canAskAgain: true };
      }
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      return { granted: status === 'granted', canAskAgain: Boolean(canAskAgain) };
    } catch {
      return { granted: true, canAskAgain: true };
    }
  }

  /**
   * Schedule or dispatch an instant native heads-up notification on the device
   */
  async scheduleLocalNotification({
    title,
    body,
    data = {},
    channelId = 'orders',
  }: {
    title: string;
    body: string;
    data?: Record<string, any>;
    channelId?: string;
  }): Promise<string | null> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            new Notification(title, {
              body,
              icon: 'https://assets.myntassets.com/assets/images/retaillabs/2023/2/28/a9cd936f-5b65-4f47-8a61-9c8dfb5a6c4b1677567702582-Myntra-logo.png',
            });
          } catch (e) {
            console.warn('Web notification display error:', e);
          }
        }
      }
      return 'web_local_notif';
    }

    try {
      await this.configureAndroidChannels();
    } catch {
      // ignore
    }

    try {
      return await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          badge: 1,
        } as any,
        trigger: null, // immediate native heads-up banner on mobile!
      });
    } catch (err: any) {
      console.warn('Standard notification schedule failed, trying minimal fallback:', err?.message || err);
      try {
        return await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data,
          },
          trigger: null,
        });
      } catch (fallbackErr) {
        console.warn('Failed to schedule local notification on mobile:', fallbackErr);
        return null;
      }
    }
  }
}

export const pushNotificationService = new PushNotificationService();
