const db = require('../db');

class NotificationLog {
  static findAll() {
    const data = db.read();
    return data.notificationLogs || [];
  }

  static createLog({
    notificationId,
    userId,
    token,
    status = 'sent', // 'sent' | 'delivered' | 'failed' | 'deactivated'
    ticketId = null,
    error = null,
    metadata = {},
  }) {
    const data = db.read();
    const logs = data.notificationLogs || [];

    const newLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      notificationId: notificationId || null,
      userId: userId || null,
      token: token ? `${token.substring(0, 15)}...` : null,
      fullToken: token || null,
      status,
      ticketId: ticketId || null,
      error: error || null,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
    };

    logs.unshift(newLog);
    // Keep last 500 logs to avoid unbounded growth
    if (logs.length > 500) {
      logs.length = 500;
    }

    data.notificationLogs = logs;
    db.write(data);

    return newLog;
  }

  static findByUserId(userId) {
    if (!userId) return [];
    const all = this.findAll();
    return all.filter((l) => l.userId === userId);
  }
}

module.exports = NotificationLog;
