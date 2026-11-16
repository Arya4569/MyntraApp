const realtimeService = require('./realtimeService');
const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');
const NotificationPreference = require('../models/NotificationPreference');
const NotificationLog = require('../models/NotificationLog');
const db = require('../db');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Helper to check if a token matches the Expo push token pattern
const isExpoPushToken = (token) => {
  if (typeof token !== 'string') return false;
  return /^(ExponentPushToken|ExpoPushToken)\[.*\]$/.test(token.trim());
};

class NotificationService {
  /**
   * Main dispatch method: validates preferences, creates persistent in-app notification,
   * finds active device tokens, and dispatches to Expo push server.
   */
  static async sendNotification({
    userId,
    title,
    message,
    category = 'order',
    data = {},
    idempotencyKey = null,
  }) {
    if (!userId || !title || !message) {
      throw new Error('userId, title, and message are required.');
    }

    // 1. Check user notification preferences for this category
    const isAllowed = NotificationPreference.isAllowed(userId, category);
    if (!isAllowed) {
      // User disabled this notification category
      NotificationLog.createLog({
        userId,
        status: 'filtered',
        error: `Notification suppressed by user preference for category: ${category}`,
        metadata: { category, title },
      });
      return {
        success: false,
        suppressed: true,
        reason: `User has disabled notifications for ${category}`,
      };
    }

    // 2. Create in-app persistent notification record (with deduplication check)
    const { notification, isDuplicate } = Notification.create({
      userId,
      title,
      message,
      category,
      data,
      idempotencyKey,
    });

    if (isDuplicate) {
      return {
        success: true,
        duplicate: true,
        notification,
        message: 'Notification already sent for this event (deduplicated).',
      };
    }

    // Push real-time SSE event strictly to this specific user's connected clients
    try {
      realtimeService.notifyUserNewNotification(userId, notification);
    } catch (rtErr) {
      console.warn('Realtime notifyUserNewNotification error:', rtErr.message);
    }

    // 3. Find active device push tokens for this user
    const activeTokens = DeviceToken.findByUserId(userId);
    const unreadCount = Notification.countUnread(userId);

    // Check if device push delivery is enabled for this user
    const isPushActive = NotificationPreference.isPushEnabled(userId);
    if (!isPushActive) {
      NotificationLog.createLog({
        notificationId: notification.id,
        userId,
        status: 'push_disabled_by_user',
        error: 'Push notification delivery disabled in user preferences',
        metadata: { category, title },
      });

      return {
        success: true,
        inAppOnly: true,
        pushSuppressed: true,
        notification,
        message: 'In-app notification created; push notification suppressed by user preference.',
      };
    }

    if (activeTokens.length === 0) {
      // In-app notification created, no push device tokens currently registered
      NotificationLog.createLog({
        notificationId: notification.id,
        userId,
        status: 'in_app_only',
        metadata: { reason: 'No active device tokens found for user' },
      });

      return {
        success: true,
        inAppOnly: true,
        notification,
      };
    }

    // 4. Prepare push messages for each registered active device
    const pushMessages = [];
    for (const device of activeTokens) {
      if (!isExpoPushToken(device.token)) {
        // If simulated or test token, log and skip network request
        NotificationLog.createLog({
          notificationId: notification.id,
          userId,
          token: device.token,
          status: 'simulated_delivery',
          metadata: { note: 'Non-Expo format token recorded for simulation/test' },
        });
        continue;
      }

      pushMessages.push({
        to: device.token,
        title,
        body: message,
        data: {
          ...data,
          notificationId: notification.id,
          category,
        },
        sound: 'default',
        badge: unreadCount,
        channelId:
          category === 'order' || category === 'shipping' || category === 'payment'
            ? 'orders'
            : category === 'promotion'
            ? 'offers'
            : 'default',
        priority: 'high',
      });
    }

    // 5. Send push notifications via Expo API
    let deliveryResults = [];
    if (pushMessages.length > 0) {
      try {
        deliveryResults = await this.dispatchExpoPush(pushMessages, notification.id, userId);
      } catch (err) {
        console.error('Error dispatching Expo push notification:', err.message);
      }
    }

    return {
      success: true,
      notification,
      pushSentCount: pushMessages.length,
      deliveryResults,
    };
  }

  /**
   * Dispatches push message batch to Expo Push API and handles tickets/errors
   */
  static async dispatchExpoPush(messages, notificationId, userId) {
    const results = [];
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    };

    if (process.env.EXPO_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    }

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(messages),
      });

      const json = await response.json();
      const tickets = json.data || [];

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const ticket = tickets[i] || {};

        if (ticket.status === 'error') {
          const errorCode = ticket.details?.error || ticket.message || 'UnknownError';

          // Automatic deactivation: If token is unregistered, deactivate it immediately!
          if (errorCode === 'DeviceNotRegistered') {
            DeviceToken.deactivateInvalidToken(msg.to);
            NotificationLog.createLog({
              notificationId,
              userId,
              token: msg.to,
              status: 'deactivated',
              error: 'DeviceNotRegistered: Token deactivated automatically',
            });
          } else {
            NotificationLog.createLog({
              notificationId,
              userId,
              token: msg.to,
              status: 'failed',
              error: errorCode,
            });
          }

          results.push({ token: msg.to, status: 'error', error: errorCode });
        } else {
          // Status ok
          NotificationLog.createLog({
            notificationId,
            userId,
            token: msg.to,
            status: 'sent',
            ticketId: ticket.id || null,
          });

          results.push({ token: msg.to, status: 'ok', ticketId: ticket.id });
        }
      }
    } catch (err) {
      for (const msg of messages) {
        NotificationLog.createLog({
          notificationId,
          userId,
          token: msg.to,
          status: 'failed',
          error: err.message,
        });
        results.push({ token: msg.to, status: 'error', error: err.message });
      }
    }

    return results;
  }

  /* ========================================================
   * SPECIFIC EVENT TRIGGERS
   * ======================================================== */

  /**
   * A. Order Confirmation
   */
  static async sendOrderConfirmation(userId, order) {
    if (!order || !order.id) return null;
    return this.sendNotification({
      userId,
      title: 'Order Confirmed! 🎉',
      message: `Your order #${order.id} for ₹${order.totalAmount} has been placed successfully.`,
      category: 'order',
      data: {
        orderId: order.id,
        screen: 'orders',
        totalAmount: order.totalAmount,
      },
      idempotencyKey: `order_confirmed_${order.id}`,
    });
  }

  /**
   * B. Payment Verification Updates (Verified only!)
   */
  static async sendPaymentVerified(userId, orderId, paymentId, amount) {
    if (!orderId || !paymentId) return null;
    return this.sendNotification({
      userId,
      title: 'Payment Successful 💳',
      message: `Payment ${paymentId} for Order #${orderId} of ₹${amount || 499} verified securely.`,
      category: 'payment',
      data: {
        orderId,
        paymentId,
        screen: 'orders',
      },
      idempotencyKey: `payment_verified_${paymentId}`,
    });
  }

  /**
   * C. Shipping and Delivery Updates
   */
  static async sendShippingUpdate(userId, orderId, status) {
    if (!orderId || !status) return null;

    let title = 'Order Update 📦';
    let message = `Your order #${orderId} status is now ${status}.`;

    if (status === 'Shipped') {
      title = 'Order Shipped 🚚';
      message = `Your order #${orderId} has been shipped from our warehouse!`;
    } else if (status === 'Out for Delivery') {
      title = 'Out for Delivery 🛵';
      message = `Your order #${orderId} is out for delivery today. Keep your phone handy!`;
    } else if (status === 'Delivered') {
      title = 'Order Delivered! 🎉';
      message = `Your order #${orderId} has been delivered. Enjoy your purchase!`;
    }

    return this.sendNotification({
      userId,
      title,
      message,
      category: 'shipping',
      data: {
        orderId,
        status,
        screen: 'orders',
      },
      idempotencyKey: `shipping_${orderId}_${status}`,
    });
  }

  /**
   * D. Wishlist Price Drops
   */
  static async sendPriceDropAlert(productId, oldPrice, newPrice) {
    const dbData = db.read();
    const wishlists = dbData.wishlists || {};
    const products = dbData.products || [];
    const product = products.find((p) => p.id === productId);

    if (!product) return { notifiedCount: 0 };

    const discountAmount = Math.max(0, oldPrice - newPrice);
    const dropPercent = Math.round((discountAmount / oldPrice) * 100);

    const affectedUsers = [];
    for (const [userId, userWishlist] of Object.entries(wishlists)) {
      if (Array.isArray(userWishlist) && userWishlist.includes(productId)) {
        affectedUsers.push(userId);
      }
    }

    let notifiedCount = 0;
    for (const userId of affectedUsers) {
      const res = await this.sendNotification({
        userId,
        title: `Price Drop Alert! 🏷️ ${dropPercent}% OFF`,
        message: `${product.brand || 'Item'} "${product.name}" from your Wishlist dropped from ₹${oldPrice} to ₹${newPrice}!`,
        category: 'wishlist',
        data: {
          productId: product.id,
          screen: 'product',
          oldPrice,
          newPrice,
        },
        idempotencyKey: `price_drop_${productId}_${newPrice}_${userId}`,
      });
      if (res.success && !res.duplicate) notifiedCount++;
    }

    return { notifiedCount, affectedUsers: affectedUsers.length };
  }

  /**
   * E. Back-in-Stock Alerts
   */
  static async sendStockAlert(productId) {
    const dbData = db.read();
    const wishlists = dbData.wishlists || {};
    const products = dbData.products || [];
    const product = products.find((p) => p.id === productId);

    if (!product) return { notifiedCount: 0 };

    const affectedUsers = [];
    for (const [userId, userWishlist] of Object.entries(wishlists)) {
      if (Array.isArray(userWishlist) && userWishlist.includes(productId)) {
        affectedUsers.push(userId);
      }
    }

    let notifiedCount = 0;
    for (const userId of affectedUsers) {
      const res = await this.sendNotification({
        userId,
        title: 'Back in Stock! ⚡',
        message: `${product.brand || 'Item'} "${product.name}" is back in stock! Grab yours before it sells out.`,
        category: 'stock',
        data: {
          productId: product.id,
          screen: 'product',
        },
        idempotencyKey: `back_in_stock_${productId}_${Date.now()}_${userId}`,
      });
      if (res.success && !res.duplicate) notifiedCount++;
    }

    return { notifiedCount, affectedUsers: affectedUsers.length };
  }

  /**
   * F. Promotional Campaigns
   */
  static async sendPromotion({
    title,
    message,
    couponCode = null,
    discountPercent = null,
    category = 'all',
  }) {
    const dbData = db.read();
    const users = dbData.users || [];
    let sentCount = 0;

    for (const user of users) {
      const res = await this.sendNotification({
        userId: user.id,
        title: title || 'Exclusive Fashion Sale! 🔥',
        message: message || 'Explore top brand deals and seasonal styles at up to 70% OFF.',
        category: 'promotion',
        data: {
          couponCode: couponCode || 'MYNTRA50',
          discountPercent: discountPercent || 50,
          category,
          screen: 'offers',
        },
      });
      if (res.success) sentCount++;
    }

    return { sentCount, totalUsers: users.length };
  }

  /**
   * G. Abandoned-Cart Reminders
   */
  static async checkAbandonedCarts(targetUserId = null) {
    const dbData = db.read();
    const bags = dbData.bags || {};
    const products = dbData.products || [];
    const remindedUsers = [];

    const userIds = targetUserId ? [targetUserId] : Object.keys(bags);
    for (const userId of userIds) {
      const items = bags[userId];
      if (Array.isArray(items) && items.length > 0) {
        // Build readable item summary
        const firstItem = items[0];
        const matchedProduct = products.find((p) => p.id === firstItem.productId);
        const itemName = matchedProduct ? matchedProduct.name : 'items';
        const itemCount = items.length;

        const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const idempotencyKey = `abandoned_cart_${userId}_${dateKey}`;

        const res = await this.sendNotification({
          userId,
          title: 'Items waiting in your bag! 🛍️',
          message:
            itemCount === 1
              ? `You left "${itemName}" in your bag. Complete your purchase before it sells out!`
              : `You have ${itemCount} items waiting in your bag including "${itemName}". Complete checkout now!`,
          category: 'cart',
          data: {
            screen: 'bag',
            itemCount,
          },
          idempotencyKey,
        });

        if (res.success && !res.duplicate) {
          remindedUsers.push(userId);
        }
      }
    }

    return {
      remindedCount: remindedUsers.length,
      users: remindedUsers,
    };
  }
}

module.exports = NotificationService;
