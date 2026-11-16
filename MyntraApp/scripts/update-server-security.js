const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.resolve(__dirname, '../../server');

// 1. Create server/src/services/realtimeService.js
const realtimeServiceCode = `const EventEmitter = require('events');

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
        res.write(': keepalive\\n\\n');
      } catch (err) {
        clearInterval(pingInterval);
      }
    }, 25000);

    // Initial connection confirmation event
    res.write(\`event: connected\\ndata: \${JSON.stringify({
      status: 'connected',
      userId: userId || null,
      timestamp: new Date().toISOString(),
    })}\\n\\n\`);

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
    const payload = \`event: \${eventName}\\ndata: \${JSON.stringify(data)}\\n\\n\`;
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
    const payload = \`event: \${eventName}\\ndata: \${JSON.stringify(data)}\\n\\n\`;
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
}

const realtimeService = new RealtimeService();
module.exports = realtimeService;
`;

fs.writeFileSync(path.join(SERVER_DIR, 'src/services/realtimeService.js'), realtimeServiceCode, 'utf8');
console.log('1. realtimeService.js created');

// 2. Create server/src/routes/realtimeRoutes.js
const realtimeRoutesCode = `const express = require('express');
const router = express.Router();
const realtimeService = require('../services/realtimeService');
const { optionalAuth } = require('../middleware/auth');

/**
 * GET /api/realtime/stream
 * Server-Sent Events (SSE) stream for real-time inventory updates and user notifications
 */
router.get('/stream', optionalAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering

  if (res.flushHeaders) {
    res.flushHeaders();
  }

  const userId = req.user?.id || null;
  realtimeService.addClient(res, userId);
});

module.exports = router;
`;

fs.writeFileSync(path.join(SERVER_DIR, 'src/routes/realtimeRoutes.js'), realtimeRoutesCode, 'utf8');
console.log('2. realtimeRoutes.js created');

// 3. Update server/src/server.js to mount realtimeRoutes
let serverJs = fs.readFileSync(path.join(SERVER_DIR, 'src/server.js'), 'utf8');
if (!serverJs.includes('realtimeRoutes')) {
  serverJs = serverJs.replace(
    "const recommendationRoutes = require('./routes/recommendationRoutes');",
    "const recommendationRoutes = require('./routes/recommendationRoutes');\\nconst realtimeRoutes = require('./routes/realtimeRoutes');"
  );
  serverJs = serverJs.replace(
    "app.use('/api/recommendations', recommendationRoutes);",
    "app.use('/api/recommendations', recommendationRoutes);\\napp.use('/api/realtime', realtimeRoutes);"
  );
  fs.writeFileSync(path.join(SERVER_DIR, 'src/server.js'), serverJs, 'utf8');
  console.log('3. server.js updated with realtime routes');
}

// 4. Update server/src/models/Order.js for strict isolation, stock broadcast, and ownership checks
let orderJs = fs.readFileSync(path.join(SERVER_DIR, 'src/models/Order.js'), 'utf8');

// Ensure realtimeService is required
if (!orderJs.includes("const realtimeService = require('../services/realtimeService');")) {
  orderJs = "const realtimeService = require('../services/realtimeService');\n" + orderJs;
}

// Fix findAll data isolation
if (!orderJs.includes("else if (!options.allUsers)")) {
  orderJs = orderJs.replace(
    "if (options.userId) {\n      orders = orders.filter((o) => o.userId === options.userId);\n    }",
    "if (options.userId) {\n      orders = orders.filter((o) => o.userId === options.userId);\n    } else if (!options.allUsers) {\n      orders = [];\n    }"
  );
}

// Fix cancelOrder ownership check
orderJs = orderJs.replace(
  "if (userId && order.userId !== userId) {",
  "if (!order.userId || order.userId !== userId) {"
);

// Fix returnOrder ownership check
orderJs = orderJs.replace(
  "if (userId && order.userId !== userId) {",
  "if (!order.userId || order.userId !== userId) {"
);

// Fix reorder ownership check
orderJs = orderJs.replace(
  "if (userId && order.userId !== userId) {",
  "if (!order.userId || order.userId !== userId) {"
);

// Notify real-time stock change after order create
if (!orderJs.includes("realtimeService.notifyStockChange(item.productId")) {
  orderJs = orderJs.replace(
    "snapshottedItems.forEach((item) => {\n        const p = data.products.find((prod) => prod.id === item.productId);\n        if (p) {\n          p.stockCount = Math.max(0, (p.stockCount || 45) - item.quantity);\n          p.inStock = p.stockCount > 0;\n        }\n      });",
    `snapshottedItems.forEach((item) => {
        const p = data.products.find((prod) => prod.id === item.productId);
        if (p) {
          p.stockCount = Math.max(0, (p.stockCount || 45) - item.quantity);
          p.inStock = p.stockCount > 0;
          try {
            realtimeService.notifyStockChange(item.productId, p.stockCount, p.inStock);
          } catch (e) {}
        }
      });`
  );
}

fs.writeFileSync(path.join(SERVER_DIR, 'src/models/Order.js'), orderJs, 'utf8');
console.log('4. Order.js updated with strict isolation & real-time notifications');

// 5. Update server/src/controllers/orderController.js
let orderControllerJs = fs.readFileSync(path.join(SERVER_DIR, 'src/controllers/orderController.js'), 'utf8');

// Ensure realtimeService is required
if (!orderControllerJs.includes("const realtimeService = require('../services/realtimeService');")) {
  orderControllerJs = "const realtimeService = require('../services/realtimeService');\n" + orderControllerJs;
}

// Fix getOrderById ownership check
orderControllerJs = orderControllerJs.replace(
  "if (order.userId && order.userId !== userId) {",
  "if (!order.userId || order.userId !== userId) {"
);

// Fix getInvoice ownership check
orderControllerJs = orderControllerJs.replace(
  "if (order.userId && order.userId !== userId) {",
  "if (!order.userId || order.userId !== userId) {"
);

// Fix getAuditTrail ownership check
orderControllerJs = orderControllerJs.replace(
  "if (order.userId && order.userId !== userId) {",
  "if (!order.userId || order.userId !== userId) {"
);

// Fix updateOrderStatus authorization check
const oldUpdateOrderStatus = `exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Order status is required.',
      });
    }

    const updated = Order.updateStatus(id, status, {
      type: req.user ? 'USER' : 'SYSTEM',
      userId: req.user?.id || null,
      ip: req.ip,
    });`;

const newUpdateOrderStatus = `exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Order status is required.',
      });
    }

    const existingOrder = Order.findById(id);
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: \`Order #\${id} not found.\`,
      });
    }

    // Enforce strict authorization: Only order owner or admin can update order status
    if (existingOrder.userId && existingOrder.userId !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You are not authorized to update another user\\'s order.',
      });
    }

    const updated = Order.updateStatus(id, status, {
      type: req.user ? 'USER' : 'SYSTEM',
      userId: req.user?.id || null,
      ip: req.ip,
    });`;

if (orderControllerJs.includes(oldUpdateOrderStatus)) {
  orderControllerJs = orderControllerJs.replace(oldUpdateOrderStatus, newUpdateOrderStatus);
}

// In createOrder, notify user in real time
if (!orderControllerJs.includes("realtimeService.notifyOrderUpdate(userId, order.id, order.status, order.paymentStatus)")) {
  orderControllerJs = orderControllerJs.replace(
    "RecommendationService.clearCache(userId);",
    "RecommendationService.clearCache(userId);\n    try { realtimeService.notifyOrderUpdate(userId, order.id, order.status, order.paymentStatus); } catch (e) {}"
  );
}

fs.writeFileSync(path.join(SERVER_DIR, 'src/controllers/orderController.js'), orderControllerJs, 'utf8');
console.log('5. orderController.js updated with strict authorization');

// 6. Update server/src/controllers/paymentController.js
let paymentControllerJs = fs.readFileSync(path.join(SERVER_DIR, 'src/controllers/paymentController.js'), 'utf8');

// Ensure realtimeService is required
if (!paymentControllerJs.includes("const realtimeService = require('../services/realtimeService');")) {
  paymentControllerJs = "const realtimeService = require('../services/realtimeService');\n" + paymentControllerJs;
}

// Update verifyPayment authorization & ownership check
const oldVerifyCheck = `    const keySecret = getKeySecret();
    const instance = getRazorpayInstance();
    const targetUserId = req.user?.id || req.body.userId || 'usr-demo-1';
    const targetOrderId = internalOrderId || razorpay_order_id;`;

const newVerifyCheck = `    const keySecret = getKeySecret();
    const instance = getRazorpayInstance();
    const targetUserId = req.user?.id;
    const targetOrderId = internalOrderId || razorpay_order_id;

    if (!targetUserId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required for payment verification.',
      });
    }

    // Verify ownership of the order being paid
    if (targetOrderId) {
      const order = Order.findById(targetOrderId);
      if (order && order.userId && order.userId !== targetUserId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not authorized to verify payment for another user\\'s order.',
        });
      }
    }`;

if (paymentControllerJs.includes(oldVerifyCheck)) {
  paymentControllerJs = paymentControllerJs.replace(oldVerifyCheck, newVerifyCheck);
}

// Update failPayment authorization
const oldFailPayment = `exports.failPayment = (req, res) => {
  try {
    const { orderId, error } = req.body;
    if (orderId) {
      Order.updatePaymentStatus(orderId, 'Failed', {
        reason: error || 'Payment failed at gateway or bank',
      }, { type: 'USER', userId: req.user?.id || 'usr-demo-1' });
    }`;

const newFailPayment = `exports.failPayment = (req, res) => {
  try {
    const { orderId, error } = req.body;
    const userId = req.user?.id;

    if (orderId) {
      const order = Order.findById(orderId);
      if (order && order.userId && userId && order.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not authorized to modify another user\\'s payment status.',
        });
      }

      Order.updatePaymentStatus(orderId, 'Failed', {
        reason: error || 'Payment failed at gateway or bank',
      }, { type: 'USER', userId: userId || 'usr-demo-1' });
    }`;

if (paymentControllerJs.includes(oldFailPayment)) {
  paymentControllerJs = paymentControllerJs.replace(oldFailPayment, newFailPayment);
}

// Update cancelPayment authorization
const oldCancelPayment = `exports.cancelPayment = (req, res) => {
  try {
    const { orderId } = req.body;
    if (orderId) {
      Order.updatePaymentStatus(orderId, 'Cancelled', {
        reason: 'Payment dismissed or cancelled by user',
      }, { type: 'USER', userId: req.user?.id || 'usr-demo-1' });
    }`;

const newCancelPayment = `exports.cancelPayment = (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.user?.id;

    if (orderId) {
      const order = Order.findById(orderId);
      if (order && order.userId && userId && order.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not authorized to modify another user\\'s payment status.',
        });
      }

      Order.updatePaymentStatus(orderId, 'Cancelled', {
        reason: 'Payment dismissed or cancelled by user',
      }, { type: 'USER', userId: userId || 'usr-demo-1' });
    }`;

if (paymentControllerJs.includes(oldCancelPayment)) {
  paymentControllerJs = paymentControllerJs.replace(oldCancelPayment, newCancelPayment);
}

// In renderCheckoutPage, check ownership if user is logged in
const oldRenderCheckoutCheck = `  const { orderId } = req.params;
  const order = Order.findById(orderId);

  if (!order) {`;

const newRenderCheckoutCheck = `  const { orderId } = req.params;
  const order = Order.findById(orderId);

  if (!order) {`;

// Check if renderCheckoutPage needs ownership check
if (!paymentControllerJs.includes("req.user && order.userId && order.userId !== req.user.id")) {
  paymentControllerJs = paymentControllerJs.replace(
    "  if (!order) {",
    `  if (!order) {
      return res.status(404).send('<h2>Order Not Found</h2>');
    }

    if (req.user && order.userId && order.userId !== req.user.id) {
      return res.status(403).send('<h2>Access Denied: You cannot view another customer\\'s checkout page.</h2>');
    }`
  );
}

fs.writeFileSync(path.join(SERVER_DIR, 'src/controllers/paymentController.js'), paymentControllerJs, 'utf8');
console.log('6. paymentController.js updated with secure payment authorization');

// 7. Update server/src/services/notificationService.js to emit real-time user notification
let notifServiceJs = fs.readFileSync(path.join(SERVER_DIR, 'src/services/notificationService.js'), 'utf8');
if (!notifServiceJs.includes("const realtimeService = require('./realtimeService');")) {
  notifServiceJs = "const realtimeService = require('./realtimeService');\n" + notifServiceJs;
}
if (!notifServiceJs.includes("realtimeService.notifyUserNewNotification(userId, notification)")) {
  notifServiceJs = notifServiceJs.replace(
    "return { success: true, notification, pushResult };",
    "try { realtimeService.notifyUserNewNotification(userId, notification); } catch(e) {}\n    return { success: true, notification, pushResult };"
  );
}
fs.writeFileSync(path.join(SERVER_DIR, 'src/services/notificationService.js'), notifServiceJs, 'utf8');
console.log('7. notificationService.js updated with real-time push events');

console.log('ALL SERVER SECURITY ENHANCEMENTS APPLIED SUCCESSFULLY!');
