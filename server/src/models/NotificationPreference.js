const db = require('../db');

const DEFAULT_PREFERENCES = {
  pushNotificationsEnabled: true,
  devicePushEnabled: true,
  orderUpdates: true,
  paymentUpdates: true,
  wishlistPriceDrops: true,
  stockAlerts: true,
  promotions: true,
  cartReminders: true,
};

class NotificationPreference {
  static getByUserId(userId) {
    if (!userId) return { ...DEFAULT_PREFERENCES };

    const data = db.read();
    const prefs = data.notificationPreferences || {};
    const userPref = prefs[userId];

    if (!userPref) {
      return {
        ...DEFAULT_PREFERENCES,
        userId,
        updatedAt: new Date().toISOString(),
      };
    }

    const pushEnabled =
      userPref.pushNotificationsEnabled !== false &&
      userPref.devicePushEnabled !== false;

    return {
      pushNotificationsEnabled: pushEnabled,
      devicePushEnabled: pushEnabled,
      orderUpdates: userPref.orderUpdates !== false,
      paymentUpdates: userPref.paymentUpdates !== false,
      wishlistPriceDrops: userPref.wishlistPriceDrops !== false,
      stockAlerts: userPref.stockAlerts !== false,
      promotions: userPref.promotions !== false,
      cartReminders: userPref.cartReminders !== false,
      userId,
      updatedAt: userPref.updatedAt || new Date().toISOString(),
    };
  }

  static update(userId, updates) {
    if (!userId) {
      throw new Error('userId is required to update notification preferences.');
    }

    const data = db.read();
    const prefs = data.notificationPreferences || {};
    const existing = prefs[userId] || { ...DEFAULT_PREFERENCES };

    const allowedKeys = [
      'pushNotificationsEnabled',
      'devicePushEnabled',
      'orderUpdates',
      'paymentUpdates',
      'wishlistPriceDrops',
      'stockAlerts',
      'promotions',
      'cartReminders',
    ];

    const sanitizedUpdates = {};
    for (const key of allowedKeys) {
      if (typeof updates[key] === 'boolean') {
        sanitizedUpdates[key] = updates[key];
      }
    }

    // Keep pushNotificationsEnabled and devicePushEnabled synchronized
    if (
      typeof sanitizedUpdates.pushNotificationsEnabled === 'boolean' &&
      sanitizedUpdates.devicePushEnabled === undefined
    ) {
      sanitizedUpdates.devicePushEnabled = sanitizedUpdates.pushNotificationsEnabled;
    }
    if (
      typeof sanitizedUpdates.devicePushEnabled === 'boolean' &&
      sanitizedUpdates.pushNotificationsEnabled === undefined
    ) {
      sanitizedUpdates.pushNotificationsEnabled = sanitizedUpdates.devicePushEnabled;
    }

    const updated = {
      ...existing,
      ...sanitizedUpdates,
      userId,
      updatedAt: new Date().toISOString(),
    };

    prefs[userId] = updated;
    data.notificationPreferences = prefs;
    db.write(data);

    return updated;
  }

  /**
   * Check if a specific notification category is allowed for a user
   */
  static isAllowed(userId, category) {
    const prefs = this.getByUserId(userId);
    const masterPushEnabled = prefs.pushNotificationsEnabled !== false;

    // Optional notification categories: promotions, cart reminders, wishlist price drops, back-in-stock
    const optionalCategories = ['promotion', 'cart', 'wishlist', 'stock'];
    if (!masterPushEnabled && optionalCategories.includes(category)) {
      return false;
    }

    switch (category) {
      case 'order':
        return prefs.orderUpdates !== false;
      case 'payment':
        return prefs.paymentUpdates !== false;
      case 'shipping':
        return prefs.orderUpdates !== false;
      case 'wishlist':
        return prefs.wishlistPriceDrops !== false;
      case 'stock':
        return prefs.stockAlerts !== false;
      case 'promotion':
        return prefs.promotions !== false;
      case 'cart':
        return prefs.cartReminders !== false;
      default:
        return true;
    }
  }

  /**
   * Check if master device push delivery is enabled for a user
   */
  static isPushEnabled(userId) {
    const prefs = this.getByUserId(userId);
    return prefs.pushNotificationsEnabled !== false;
  }
}

module.exports = NotificationPreference;
