const db = require('../db');

class Notification {
  static findAll() {
    const data = db.read();
    return data.notifications || [];
  }

  static findById(id) {
    if (!id) return null;
    const all = this.findAll();
    return all.find((n) => n.id === id) || null;
  }

  static findByUserId(userId, { page = 1, limit = 20, category = 'all' } = {}) {
    if (!userId) return { notifications: [], total: 0, page: 1, limit: 20, totalPages: 0, unreadCount: 0 };

    const all = this.findAll();
    let userNotifs = all.filter((n) => n.userId === userId);

    const unreadCount = userNotifs.filter((n) => !n.read).length;

    if (category && category !== 'all') {
      userNotifs = userNotifs.filter((n) => n.category === category);
    }

    // Sort descending by creation date (newest first)
    userNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const total = userNotifs.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = userNotifs.slice(startIndex, startIndex + limitNum);

    return {
      notifications: paginated,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      unreadCount,
    };
  }

  static countUnread(userId) {
    if (!userId) return 0;
    const all = this.findAll();
    return all.filter((n) => n.userId === userId && !n.read).length;
  }

  static create({
    userId,
    title,
    message,
    category = 'order',
    data = {},
    idempotencyKey = null,
  }) {
    if (!userId || !title || !message) {
      throw new Error('userId, title, and message are required to create a notification.');
    }

    const dbData = db.read();
    const notifications = dbData.notifications || [];

    // Deduplication check: if idempotencyKey is provided, check if already recorded
    if (idempotencyKey) {
      const existing = notifications.find(
        (n) => n.idempotencyKey === idempotencyKey && n.userId === userId
      );
      if (existing) {
        return { notification: existing, isDuplicate: true };
      }
    }

    const now = new Date().toISOString();
    const newNotif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      title: title.trim(),
      message: message.trim(),
      category, // 'order' | 'payment' | 'shipping' | 'wishlist' | 'stock' | 'promotion' | 'cart'
      data: data || {},
      read: false,
      idempotencyKey: idempotencyKey || null,
      createdAt: now,
      readAt: null,
    };

    notifications.unshift(newNotif);
    dbData.notifications = notifications;
    db.write(dbData);

    return { notification: newNotif, isDuplicate: false };
  }

  static markAsRead(id, userId) {
    const dbData = db.read();
    const notifications = dbData.notifications || [];
    const index = notifications.findIndex((n) => n.id === id);

    if (index === -1) return null;

    const notif = notifications[index];
    // Authorization check: User can only mark their own notification as read
    if (userId && notif.userId !== userId) {
      const error = new Error('Unauthorized: You cannot access or modify this notification.');
      error.status = 403;
      throw error;
    }

    if (!notif.read) {
      notif.read = true;
      notif.readAt = new Date().toISOString();
      notifications[index] = notif;
      dbData.notifications = notifications;
      db.write(dbData);
    }

    return notif;
  }

  static markAllAsRead(userId) {
    if (!userId) return 0;

    const dbData = db.read();
    const notifications = dbData.notifications || [];
    let modifiedCount = 0;
    const now = new Date().toISOString();

    const updated = notifications.map((n) => {
      if (n.userId === userId && !n.read) {
        modifiedCount++;
        return {
          ...n,
          read: true,
          readAt: now,
        };
      }
      return n;
    });

    if (modifiedCount > 0) {
      dbData.notifications = updated;
      db.write(dbData);
    }

    return modifiedCount;
  }

  static delete(id, userId) {
    const dbData = db.read();
    const notifications = dbData.notifications || [];
    const index = notifications.findIndex((n) => n.id === id);

    if (index === -1) return false;

    if (userId && notifications[index].userId !== userId) {
      const error = new Error('Unauthorized: You cannot delete this notification.');
      error.status = 403;
      throw error;
    }

    notifications.splice(index, 1);
    dbData.notifications = notifications;
    db.write(dbData);
    return true;
  }
}

module.exports = Notification;
