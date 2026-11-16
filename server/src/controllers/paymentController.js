const realtimeService = require('../services/realtimeService');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const NotificationService = require('../services/notificationService');
const AuditLog = require('../models/AuditLog');
const db = require('../db');

const Order = require('../models/Order');

const getKeyId = () => process.env.RAZORPAY_KEY_ID || '';
const getKeySecret = () => process.env.RAZORPAY_KEY_SECRET || '';

const getRazorpayInstance = () => {
  const keyId = getKeyId();
  const keySecret = getKeySecret();
  if (keyId && keySecret && !keyId.includes('placeholder')) {
    try {
      return new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    } catch (err) {
      console.warn('Failed to initialize Razorpay instance:', err);
    }
  }
  return null;
};

/**
 * GET /api/payment/key
 * Returns public key_id for client-side checkout initialization
 */
exports.getKey = (req, res) => {
  const instance = getRazorpayInstance();
  return res.status(200).json({
    success: true,
    keyId: getKeyId() || 'rzp_test_placeholder',
    isLiveConfigured: Boolean(instance),
  });
};

/**
 * POST /api/payment/create-order
 * Body: { amount: number (in INR rupees), receipt?: string, internalOrderId?: string }
 */
exports.createOrder = async (req, res) => {
  try {
    const { amount, receipt, internalOrderId } = req.body;
    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'A valid order amount is required.',
      });
    }

    // Razorpay amount in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(numericAmount * 100);
    const orderReceipt = internalOrderId || receipt || `rcpt_${Date.now()}`;
    const instance = getRazorpayInstance();

    if (instance) {
      const order = await instance.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: orderReceipt,
        notes: {
          orderId: internalOrderId || '',
          userId: req.user?.id || '',
        },
      });

      return res.status(200).json({
        success: true,
        orderId: order.id,
        internalOrderId,
        amount: order.amount,
        currency: order.currency,
        keyId: getKeyId(),
        isLive: true,
      });
    }

    // Sandbox order if API keys are placeholders
    const sandboxOrderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return res.status(200).json({
      success: true,
      orderId: sandboxOrderId,
      internalOrderId,
      amount: amountInPaise,
      currency: 'INR',
      keyId: getKeyId() || 'rzp_test_placeholder',
      isLive: false,
      sandbox: true,
      message: 'Razorpay Sandbox Mode: Set RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET in server/.env for live gateway transactions.',
    });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to create Razorpay payment order.',
    });
  }
};

/**
 * POST /api/payment/verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, internalOrderId?, amount?, userId? }
 */
exports.verifyPayment = (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      internalOrderId,
      amount,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id) {
      return res.status(400).json({
        success: false,
        error: 'Order ID and Payment ID are required for verification.',
      });
    }

    const keySecret = getKeySecret();
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
          error: 'Access denied: You are not authorized to verify payment for another user\'s order.',
        });
      }
    }

    // If live credentials not configured yet, verify sandbox test payment
    if (!instance || !keySecret || keySecret.includes('placeholder')) {
      if (targetOrderId) {
        try {
          Order.updatePaymentStatus(targetOrderId, 'Paid', {
            paymentId: razorpay_payment_id,
            gatewayOrderId: razorpay_order_id,
            gateway: 'Razorpay Sandbox Mode',
            amount: amount || 499,
          }, { type: 'USER', userId: targetUserId });
        } catch (e) {
          // Ignore if order not found in mock mode
        }
      }

      NotificationService.sendPaymentVerified(
        targetUserId,
        razorpay_order_id,
        razorpay_payment_id,
        amount || 499
      ).catch((e) => console.warn('Payment notification error:', e.message));

      AuditLog.record({
        orderId: razorpay_order_id,
        eventType: 'PAYMENT_VERIFIED',
        actor: { type: 'USER', userId: targetUserId, ip: req.ip },
        details: {
          paymentId: razorpay_payment_id,
          gateway: 'Razorpay Sandbox Mode',
          amount: amount || 499,
        },
      });

      return res.status(200).json({
        success: true,
        verified: true,
        paymentStatus: 'Paid',
        paymentId: razorpay_payment_id,
        orderId: targetOrderId,
        sandbox: true,
      });
    }

    // Official Razorpay HMAC SHA256 Signature Verification
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      if (targetOrderId) {
        Order.updatePaymentStatus(targetOrderId, 'Paid', {
          paymentId: razorpay_payment_id,
          gatewayOrderId: razorpay_order_id,
          gateway: 'Razorpay Live',
          amount: amount,
        }, { type: 'USER', userId: targetUserId });
      }

      // Trigger verified payment notification
      NotificationService.sendPaymentVerified(
        targetUserId,
        razorpay_order_id,
        razorpay_payment_id,
        amount || 499
      ).catch((e) => console.warn('Payment notification error:', e.message));

      AuditLog.record({
        orderId: razorpay_order_id,
        eventType: 'PAYMENT_VERIFIED',
        actor: { type: 'USER', userId: targetUserId, ip: req.ip },
        details: {
          paymentId: razorpay_payment_id,
          gateway: 'Razorpay Live',
          amount,
        },
      });

      return res.status(200).json({
        success: true,
        verified: true,
        paymentStatus: 'Paid',
        paymentId: razorpay_payment_id,
        orderId: targetOrderId,
      });
    } else {
      if (targetOrderId) {
        Order.updatePaymentStatus(targetOrderId, 'Failed', {
          paymentId: razorpay_payment_id,
          gatewayOrderId: razorpay_order_id,
          reason: 'Invalid transaction HMAC SHA256 signature',
        }, { type: 'USER', userId: targetUserId });
      }

      AuditLog.record({
        orderId: razorpay_order_id,
        eventType: 'PAYMENT_FAILED',
        actor: { type: 'USER', userId: targetUserId, ip: req.ip },
        details: {
          paymentId: razorpay_payment_id,
          reason: 'Invalid transaction HMAC SHA256 signature',
        },
      });

      return res.status(400).json({
        success: false,
        verified: false,
        paymentStatus: 'Failed',
        error: 'Payment verification failed: Invalid transaction signature.',
      });
    }
  } catch (err) {
    console.error('Error verifying Razorpay payment:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error verifying payment.',
    });
  }
};

/**
 * POST /api/payment/fail
 * Body: { orderId: string, error?: string }
 */
exports.failPayment = (req, res) => {
  try {
    const { orderId, error } = req.body;
    const userId = req.user?.id;

    if (orderId) {
      const order = Order.findById(orderId);
      if (order && order.userId && userId && order.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not authorized to modify another user\'s payment status.',
        });
      }

      Order.updatePaymentStatus(orderId, 'Failed', {
        reason: error || 'Payment failed at gateway or bank',
      }, { type: 'USER', userId: userId || 'system' });
    }
    return res.status(200).json({
      success: true,
      paymentStatus: 'Failed',
      message: 'Order marked as Failed payment. User may retry payment.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/payment/cancel
 * Body: { orderId: string }
 */
exports.cancelPayment = (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.user?.id;

    if (orderId) {
      const order = Order.findById(orderId);
      if (order && order.userId && userId && order.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not authorized to modify another user\'s payment status.',
        });
      }

      Order.updatePaymentStatus(orderId, 'Cancelled', {
        reason: 'Payment dismissed or cancelled by user',
      }, { type: 'USER', userId: userId || 'system' });
    }
    return res.status(200).json({
      success: true,
      paymentStatus: 'Cancelled',
      message: 'Order marked as Cancelled payment.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/payment/webhook
 * Handles incoming webhooks with signature verification and idempotent deduplication
 */
exports.handleWebhook = async (req, res) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || getKeySecret();

    // Verify webhook signature if secret and signature are provided
    if (webhookSecret && !webhookSecret.includes('placeholder') && webhookSignature) {
      const payloadString = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('hex');

      if (expectedSignature !== webhookSignature) {
        return res.status(400).json({
          success: false,
          error: 'Webhook verification failed: Invalid signature.',
        });
      }
    }

    const { event, payload, event_id } = req.body;
    const eventId =
      event_id ||
      (payload?.payment?.entity?.id ? `${event}_${payload.payment.entity.id}` : null);

    // Idempotency: Ignore duplicate webhook deliveries
    const data = db.read();
    if (!data.processedPaymentEvents) data.processedPaymentEvents = [];

    if (eventId && data.processedPaymentEvents.includes(eventId)) {
      return res.status(200).json({
        success: true,
        message: 'Duplicate webhook event already processed.',
        duplicate: true,
      });
    }

    if (eventId) {
      data.processedPaymentEvents.push(eventId);
      if (data.processedPaymentEvents.length > 500) {
        data.processedPaymentEvents = data.processedPaymentEvents.slice(-500);
      }
      db.write(data);
    }

    const paymentEntity = payload?.payment?.entity || {};
    const orderId = paymentEntity.order_id || paymentEntity.notes?.orderId;

    if (orderId) {
      const allOrders = data.orders || [];
      const orderIndex = allOrders.findIndex(
        (o) => o.id === orderId || o.id === `MYN-${orderId}`
      );

      if (orderIndex !== -1) {
        if (event === 'payment.captured') {
          allOrders[orderIndex].paymentStatus = 'Paid';
          allOrders[orderIndex].updatedAt = new Date().toISOString();
        } else if (event === 'payment.failed') {
          allOrders[orderIndex].paymentStatus = 'Failed';
          allOrders[orderIndex].updatedAt = new Date().toISOString();
        } else if (event === 'refund.processed') {
          allOrders[orderIndex].paymentStatus = 'Refunded';
          allOrders[orderIndex].updatedAt = new Date().toISOString();
        }
        data.orders = allOrders;
        db.write(data);
      }

      AuditLog.record({
        orderId,
        eventType: 'WEBHOOK_PROCESSED',
        actor: { type: 'WEBHOOK', ip: req.ip },
        details: {
          event,
          eventId,
          amount: paymentEntity.amount ? paymentEntity.amount / 100 : undefined,
          status: paymentEntity.status,
        },
      });
    }

    return res.status(200).json({
      success: true,
      received: true,
      event,
    });
  } catch (err) {
    console.error('Error handling payment webhook:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to process payment webhook.',
    });
  }
};

/**
 * GET /api/payment/checkout/:orderId
 * Serves a responsive checkout page for mobile web sessions or in-app browser
 */
exports.renderCheckoutPage = (req, res) => {
  const { orderId } = req.params;
  const order = Order.findById(orderId);

  if (!order) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Order Not Found</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 40px;">
        <h2>Order #${orderId} Not Found</h2>
        <p>Please return to the app and select your order.</p>
      </body>
      </html>
    `);
  }

  if (req.user && order.userId && order.userId !== req.user.id) {
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Access Denied</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 40px;">
        <h2>Access Denied</h2>
        <p>You cannot access another customer's checkout page.</p>
      </body>
      </html>
    `);
  }

  const keyId = getKeyId();
  const isConfigured = keyId && !keyId.includes('placeholder');
  const amountPaise = Math.round(Number(order.totalAmount || 0) * 100);

  res.setHeader('Content-Type', 'text/html');
  return res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Myntra Checkout - Order #${order.id}</title>
      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          margin: 0; padding: 20px; background: #f5f5f6;
          display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 90vh;
        }
        .checkout-card {
          background: #ffffff; border-radius: 16px; padding: 28px; width: 100%; max-width: 440px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.06); text-align: center;
        }
        .brand { font-size: 24px; font-weight: 900; color: #ff3f6c; letter-spacing: 1px; margin-bottom: 6px; }
        .subtitle { font-size: 13px; color: #7e818c; margin-bottom: 24px; }
        .amount-box {
          background: #fff5f7; border: 1px solid #ffd3dd; border-radius: 12px;
          padding: 16px; margin-bottom: 24px;
        }
        .amount-label { font-size: 12px; color: #535766; text-transform: uppercase; font-weight: 600; }
        .amount-value { font-size: 32px; font-weight: 800; color: #282c3f; margin-top: 4px; }
        .info-row { display: flex; justify-content: space-between; font-size: 13px; color: #535766; margin-bottom: 8px; }
        .info-value { font-weight: 600; color: #282c3f; }
        .btn-pay {
          background: #ff3f6c; color: white; border: none; border-radius: 8px; padding: 16px;
          font-size: 15px; font-weight: 700; width: 100%; cursor: pointer; transition: background 0.2s;
          margin-top: 16px;
        }
        .btn-pay:hover { background: #e0325d; }
        .notice-box {
          background: #fdfaf0; border: 1px solid #f6e1b7; border-radius: 8px;
          padding: 12px; font-size: 12px; color: #855900; margin-top: 16px; text-align: left;
        }
        .status-badge {
          display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700;
          background: #fff8e6; color: #b7791f; margin-bottom: 16px;
        }
      </style>
    </head>
    <body>
      <div class="checkout-card">
        <div class="brand">MYNTRA</div>
        <div class="subtitle">Official Payment Gateway</div>
        
        <span class="status-badge">PAYMENT PENDING</span>

        <div class="amount-box">
          <div class="amount-label">Amount Payable</div>
          <div class="amount-value">₹${order.totalAmount}</div>
        </div>

        <div class="info-row">
          <span>Order ID</span>
          <span class="info-value">#${order.id}</span>
        </div>
        <div class="info-row">
          <span>Items in Order</span>
          <span class="info-value">${order.items?.length || 1} item(s)</span>
        </div>
        <div class="info-row">
          <span>Supported Methods</span>
          <span class="info-value">UPI, Cards, Net Banking</span>
        </div>

        ${
          isConfigured
            ? `
          <button id="payBtn" class="btn-pay" onclick="initiateRazorpay()">PROCEED WITH SECURE PAYMENT</button>
          <div style="font-size: 11px; color: #94969f; margin-top: 12px;">
            🔒 256-bit SSL encrypted • Powered by Razorpay
          </div>
          <script>
            function initiateRazorpay() {
              const options = {
                key: '${keyId}',
                amount: ${amountPaise},
                currency: 'INR',
                name: 'Myntra Fashion',
                description: 'Payment for Order #${order.id}',
                handler: function (response) {
                  fetch('/api/payment/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      razorpay_order_id: response.razorpay_order_id || '${order.id}',
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_signature: response.razorpay_signature,
                      internalOrderId: '${order.id}',
                      amount: ${order.totalAmount}
                    })
                  })
                  .then(r => r.json())
                  .then(data => {
                    if (data.verified) {
                      window.location.href = 'myntraapp://payment-success?orderId=${order.id}&paymentId=' + response.razorpay_payment_id;
                    } else {
                      alert('Payment signature verification failed.');
                    }
                  })
                  .catch(() => alert('Network error verifying payment.'));
                },
                modal: {
                  ondismiss: function() {
                    fetch('/api/payment/cancel', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ orderId: '${order.id}' })
                    });
                  }
                }
              };
              const rzp = new Razorpay(options);
              rzp.open();
            }
          </script>
        `
            : `
          <div class="notice-box">
            <strong>Gateway Configuration Notice:</strong><br/>
            Real Razorpay credentials are not yet configured in <code>server/.env</code>.<br/>
            Order <strong>#${order.id}</strong> remains safely recorded as <em>Pending Payment</em>.
          </div>
          <button class="btn-pay" style="background: #535766;" onclick="window.close()">CLOSE CHECKOUT</button>
        `
        }
      </div>
    </body>
    </html>
  `);
};


