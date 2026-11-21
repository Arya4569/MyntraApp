const EventEmitter = require('events');

class RealtimeService extends EventEmitter {
  constructor() {
    super();
    // Map of userId -> Set of response objects
    this.userClients = new Map();
    // Set of all active response objects (for public catalog/stock broadcasts)
    this.allClients = new Set();
  }

  /**
   * Register a new SSE connection
   */
  addClient(res, userId = null) {
    this.allClients.add(res);

    if (userId) {
      if (!this.userClients.has(userId)) {
        this.userClients.set(userId, new Set());
      }
      this.userClients.get(userId).add(res);
    }

    // Keepalive ping every 25 seconds
    const pingInterval = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch (err) {
        clearInterval(pingInterval);
      }
    }, 25000);

    // Initial connection confirmation event
    res.write(`event: connected\ndata: ${JSON.stringify({
      status: 'connected',
      userId: userId || null,
      timestamp: new Date().toISOString(),
    })}\n\n`);

    // Cleanup on disconnect
    res.on('close', () => {
      clearInterval(pingInterval);
      this.removeClient(res, userId);
    });
  }

  /**
   * Remove SSE client on disconnect
   */
  removeClient(res, userId = null) {
    this.allClients.delete(res);
    if (userId && this.userClients.has(userId)) {
      const userSet = this.userClients.get(userId);
      userSet.delete(res);
      if (userSet.size === 0) {
        this.userClients.delete(userId);
      }
    }
  }

  /**
   * Broadcast message to all connected clients (e.g. stock availability changes)
   */
  broadcast(eventName, data) {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.allClients) {
      try {
        client.write(payload);
      } catch (e) {
        this.allClients.delete(client);
      }
    }
  }

  /**
   * Send private message only to a specific user's active devices/sessions
   */
  sendToUser(userId, eventName, data) {
    if (!userId || !this.userClients.has(userId)) return;
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    const clients = this.userClients.get(userId);
    for (const client of clients) {
      try {
        client.write(payload);
      } catch (e) {
        clients.delete(client);
      }
    }
  }

  /**
   * Convenience: Broadcast catalog inventory stock change
   */
  notifyStockChange(productId, stockCount, inStock) {
    this.broadcast('stock_update', {
      productId,
      stockCount,
      inStock,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Convenience: Send order status update to specific customer
   */
  notifyOrderUpdate(userId, orderId, status, paymentStatus = null) {
    this.sendToUser(userId, 'order_update', {
      orderId,
      status,
      paymentStatus,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Convenience: Send live notification delivery to specific customer
   */
  notifyUserNewNotification(userId, notification) {
    this.sendToUser(userId, 'notification', {
      notification,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Convenience: Broadcast browsing-history updates to all authenticated sessions of the same user
   */
  notifyRecentlyViewedUpdate(userId, data) {
    this.sendToUser(userId, 'recently_viewed_update', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Convenience: Broadcast cart and saved-for-later updates to all sessions of the same user
   */
  notifyCartUpdate(userId, data = {}) {
    this.sendToUser(userId, 'cart_update', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}

const realtimeService = new RealtimeService();
module.exports = realtimeService;
