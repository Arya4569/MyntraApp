import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  PUSH_TOKEN: '@myntra_push_token',
  NOTIFICATION_PERMISSION_REQUESTED: '@myntra_notif_perm_requested',
};

class PushNotificationServiceWeb {
  async configureAndroidChannels(): Promise<void> {
    // No-op on Web
  }

  async registerForPushNotificationsAsync(): Promise<{
    token: string | null;
    granted: boolean;
    isPhysicalDevice: boolean;
  }> {
    let webToken = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
    if (!webToken) {
      webToken = `ExponentPushToken[web_${Date.now()}_client]`;
      await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, webToken);
    }

    return {
      token: webToken,
      granted: true,
      isPhysicalDevice: false,
    };
  }

  async getStoredPushToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
    } catch {
      return null;
    }
  }

  async clearStoredPushToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PUSH_TOKEN);
    } catch (e) {
      console.warn('Failed to remove stored push token:', e);
    }
  }

  async clearDeliveredNotifications(): Promise<void> {
    // No-op on Web
  }

  async cancelAccountScheduledNotifications(): Promise<void> {
    // No-op on Web
  }

  addNotificationReceivedListener(
    _callback: (notification: any) => void
  ): { remove: () => void } {
    return { remove: () => {} };
  }

  addNotificationResponseReceivedListener(
    _callback: (response: any) => void
  ): { remove: () => void } {
    return { remove: () => {} };
  }

  async getLastNotificationResponse(): Promise<any | null> {
    return null;
  }

  getDeviceDetails(): { deviceName: string; platform: string; deviceId: string } {
    return {
      deviceName: 'Web Browser',
      platform: 'web',
      deviceId: `web_${Date.now()}`,
    };
  }

  async getPermissionStatus(): Promise<{ granted: boolean; canAskAgain: boolean }> {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return {
        granted: Notification.permission === 'granted' || Notification.permission === 'default',
        canAskAgain: Notification.permission !== 'denied',
      };
    }
    return { granted: true, canAskAgain: true };
  }

  async scheduleLocalNotification({
    title,
    body,
  }: {
    title: string;
    body: string;
    data?: Record<string, any>;
    channelId?: string;
  }): Promise<string | null> {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: 'https://assets.myntassets.com/assets/images/retaillabs/2023/2/28/a9cd936f-5b65-4f47-8a61-9c8dfb5a6c4b1677567702582-Myntra-logo.png',
          });
        } catch {
          // Ignore
        }
      }
    }
    return 'web_local_notif';
  }
}

export const pushNotificationService = new PushNotificationServiceWeb();
