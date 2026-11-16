const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');
const NotificationPreference = require('../models/NotificationPreference');
const NotificationService = require('../services/notificationService');

/**
 * POST /api/notifications/register-device
 * Register or update push token for authenticated user
 */
exports.registerDevice = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { pushToken, token, platform, deviceName, deviceId } = req.body;
    const finalToken = pushToken || token;

    if (!finalToken || typeof finalToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'A valid pushToken string is required.',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required to register device push token.',
      });
    }

    const deviceRecord = DeviceToken.register({
      userId,
      token: finalToken,
      platform: platform || 'android',
      deviceId,
      deviceName,
    });

    return res.status(200).json({
      success: true,
      message: 'Device push token registered successfully.',
      device: deviceRecord,
    });
  } catch (err) {
    console.error('Error registering device token:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to register device push token.',
    });
  }
};

/**
 * POST /api/notifications/unregister-device
 * Deactivate device token on logout
 */
exports.unregisterDevice = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { pushToken, token } = req.body;
    const finalToken = pushToken || token;

    if (!finalToken && !userId) {
      return res.status(400).json({
        success: false,
        error: 'pushToken or authentication session is required to unregister device.',
      });
    }

    if (finalToken) {
      DeviceToken.deactivate(finalToken, userId);
    } else if (userId) {
      DeviceToken.deactivateForUser(userId);
    }

    return res.status(200).json({
      success: true,
      message: 'Device push token deactivated successfully.',
    });
  } catch (err) {
    console.error('Error unregistering device token:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to unregister device token.',
    });
  }
};

/**
 * GET /api/notifications
 * Retrieve paginated notifications for current authenticated user
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 20, category = 'all' } = req.query;

    if (!userId) {
      // Unauthenticated guest user: return empty list, never previous user's data
      return res.status(200).json({
        success: true,
        notifications: [],
        total: 0,
        page: 1,
        limit: Math.max(1, parseInt(limit, 10) || 20),
        totalPages: 1,
        unreadCount: 0,
      });
    }

    const result = Notification.findByUserId(userId, { page, limit, category });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('Error retrieving notifications:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve notifications.',
    });
  }
};

/**
 * GET /api/notifications/unread-count
 * Retrieve accurate unread count for badge
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      // Unauthenticated guest has 0 unread notifications
      return res.status(200).json({
        success: true,
        unreadCount: 0,
      });
    }

    const count = Notification.countUnread(userId);

    return res.status(200).json({
      success: true,
      unreadCount: count,
    });
  } catch (err) {
    console.error('Error getting unread count:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve unread notification count.',
    });
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark an individual notification as read (with authorization verification)
 */
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Notification ID is required.',
      });
    }

    const updated = Notification.markAsRead(id, userId);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found.',
      });
    }

    return res.status(200).json({
      success: true,
      notification: updated,
      unreadCount: Notification.countUnread(userId),
    });
  } catch (err) {
    if (err.status === 403) {
      return res.status(403).json({
        success: false,
        error: err.message,
      });
    }
    console.error('Error marking notification as read:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read.',
    });
  }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for current user
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const count = Notification.markAllAsRead(userId);

    return res.status(200).json({
      success: true,
      message: `Marked ${count} notifications as read.`,
      modifiedCount: count,
      unreadCount: 0,
    });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read.',
    });
  }
};

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deleted = Notification.delete(id, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification deleted successfully.',
      unreadCount: Notification.countUnread(userId),
    });
  } catch (err) {
    if (err.status === 403) {
      return res.status(403).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: 'Failed to delete notification.' });
  }
};

/**
 * GET /api/notifications/preferences
 * Get notification preferences for current user
 */
exports.getPreferences = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(200).json({
        success: true,
        preferences: {
          orderUpdates: true,
          paymentUpdates: true,
          wishlistPriceDrops: true,
          stockAlerts: true,
          promotions: true,
          cartReminders: true,
          pushNotificationsEnabled: true,
        },
      });
    }

    const preferences = NotificationPreference.getByUserId(userId);

    return res.status(200).json({
      success: true,
      preferences,
    });
  } catch (err) {
    console.error('Error getting notification preferences:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve notification preferences.',
    });
  }
};

/**
 * PATCH /api/notifications/preferences
 * Update notification preferences for current user
 */
exports.updatePreferences = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required to update notification preferences.',
      });
    }
    const updates = req.body;

    const updated = NotificationPreference.update(userId, updates);

    return res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully.',
      preferences: updated,
    });
  } catch (err) {
    console.error('Error updating notification preferences:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to update notification preferences.',
    });
  }
};

/**
 * POST /api/notifications/promotions
 * Trigger promotional notification campaign
 */
exports.sendPromotion = async (req, res) => {
  try {
    const { title, message, couponCode, discountPercent, category } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        error: 'Title and message are required for promotional notifications.',
      });
    }

    const result = await NotificationService.sendPromotion({
      title,
      message,
      couponCode,
      discountPercent,
      category,
    });

    return res.status(200).json({
      success: true,
      message: `Promotional notification dispatched to ${result.sentCount} users.`,
      ...result,
    });
  } catch (err) {
    console.error('Error sending promotional notification:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to send promotional campaign.',
    });
  }
};

/**
 * POST /api/notifications/test-event
 * Test trigger endpoint for verifying any of the 7 notification events
 */
exports.triggerTestEvent = async (req, res) => {
  try {
    const userId = req.user?.id || (process.env.NODE_ENV !== 'production' && req.body?.userId) || null;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required to trigger test events.',
      });
    }
    const { eventType, orderId, productId, oldPrice, newPrice, status } = req.body;

    let result;
    switch (eventType) {
      case 'order_confirmation':
        result = await NotificationService.sendOrderConfirmation(userId, {
          id: orderId || `MYN-${Math.floor(100000 + Math.random() * 900000)}`,
          totalAmount: 1499,
        });
        break;

      case 'payment_update':
        result = await NotificationService.sendPaymentVerified(
          userId,
          orderId || 'MYN-582910',
          `pay_${Date.now()}`,
          1499
        );
        break;

      case 'shipping_update':
        result = await NotificationService.sendShippingUpdate(
          userId,
          orderId || 'MYN-582910',
          status || 'Out for Delivery'
        );
        break;

      case 'price_drop':
        result = await NotificationService.sendPriceDropAlert(
          productId || 'prod-1',
          oldPrice || 1199,
          newPrice || 499
        );
        break;

      case 'back_in_stock':
        result = await NotificationService.sendStockAlert(productId || 'prod-1');
        break;

      case 'cart_reminder':
        result = await NotificationService.checkAbandonedCarts(userId);
        break;

      case 'custom':
        result = await NotificationService.sendNotification({
          userId,
          title: req.body.title || 'Test Notification',
          message: req.body.message || 'This is a test notification from Myntra.',
          category: req.body.category || 'order',
          data: req.body.data || {},
        });
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unknown eventType: "${eventType}". Supported: order_confirmation, payment_update, shipping_update, price_drop, back_in_stock, cart_reminder, custom`,
        });
    }

    return res.status(200).json({
      success: true,
      eventType,
      result,
    });
  } catch (err) {
    console.error('Error triggering test event:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to trigger test event.',
    });
  }
};
