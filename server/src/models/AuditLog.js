const db = require('../db');

class AuditLog {
  /**
   * Sanitizes details to ensure no sensitive card data, CVV, passwords or secrets are recorded
   */
  static sanitizeDetails(details) {
    if (!details || typeof details !== 'object') return {};
    const sanitized = {};
    const sensitiveKeys = [
      'card',
      'cardnumber',
      'cvv',
      'cvc',
      'password',
      'passwordhash',
      'secret',
      'keysecret',
      'token',
      'authorization',
      'pin',
      'otp',
    ];

    for (const [key, value] of Object.entries(details)) {
      const lower = key.toLowerCase();
      if (sensitiveKeys.some((s) => lower.includes(s))) {
        // Redact or omit sensitive fields
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeDetails(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Record an order or transaction audit event
   */
  static record({
    orderId = null,
    eventType,
    actor = { type: 'SYSTEM' },
    details = {},
  }) {
    if (!eventType) {
      throw new Error('AuditLog: eventType is required');
    }

    const data = db.read();
    if (!data.auditLogs) {
      data.auditLogs = [];
    }

    const cleanActor = {
      type: actor.type || 'SYSTEM', // 'USER', 'SYSTEM', 'PAYMENT_GATEWAY', 'WEBHOOK'
      userId: actor.userId || null,
      ip: actor.ip || null,
      userAgent: actor.userAgent ? String(actor.userAgent).substring(0, 120) : null,
    };

    const entry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      orderId: orderId ? String(orderId) : null,
      eventType, // e.g. 'ORDER_CREATED', 'PAYMENT_VERIFIED', 'STATUS_CHANGED', 'ORDER_CANCELLED', 'RETURN_REQUESTED', 'REORDER_EXECUTED', 'WEBHOOK_PROCESSED'
      actor: cleanActor,
      details: this.sanitizeDetails(details),
      timestamp: new Date().toISOString(),
    };

    data.auditLogs.unshift(entry);

    // Keep up to 2000 log entries in file storage to prevent unbounded growth
    if (data.auditLogs.length > 2000) {
      data.auditLogs = data.auditLogs.slice(0, 2000);
    }

    db.write(data);
    return entry;
  }

  static findByOrderId(orderId) {
    if (!orderId) return [];
    const data = db.read();
    const cleanId = String(orderId).trim();
    return (data.auditLogs || []).filter((l) => l.orderId === cleanId);
  }

  static findAll({ orderId, eventType, limit = 50, page = 1 } = {}) {
    const data = db.read();
    let logs = [...(data.auditLogs || [])];

    if (orderId) {
      logs = logs.filter((l) => l.orderId === String(orderId));
    }
    if (eventType) {
      logs = logs.filter((l) => l.eventType === eventType);
    }

    const total = logs.length;
    const startIndex = (page - 1) * limit;
    return {
      total,
      logs: logs.slice(startIndex, startIndex + limit),
    };
  }
}

module.exports = AuditLog;
