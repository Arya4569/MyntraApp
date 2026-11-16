const realtimeService = require('../services/realtimeService');
const crypto = require('crypto');
const Order = require('../models/Order');
const AuditLog = require('../models/AuditLog');
const InvoiceService = require('../services/invoiceService');
const NotificationService = require('../services/notificationService');
const RecommendationService = require('../services/recommendationService');

/**
 * GET /api/orders
 * Get orders belonging only to the authenticated user with server-side pagination, sorting, and filters
 */
exports.getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 10,
      status = 'all',
      sortBy = 'date_desc',
      search = '',
      startDate,
      endDate,
      dateRange,
    } = req.query;

    const result = Order.findAll({
      userId,
      page,
      limit,
      status,
      sortBy,
      search,
      startDate,
      endDate,
      dateRange,
    });

    return res.status(200).json({
      success: true,
      orders: result.orders,
      pagination: result.pagination,
      filters: {
        status,
        sortBy,
        search,
        dateRange: dateRange || null,
      },
    });
  } catch (err) {
    console.error('Error fetching orders:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve orders.',
    });
  }
};

/**
 * GET /api/orders/:id
 * Get single order details with persisted snapshot and server-side authorization check
 */
exports.getOrderById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const order = Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: `Order #${id} not found.`,
      });
    }

    // Server-side authorization: User cannot view another user's orders
    if (!order.userId || order.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You are not authorized to view this order.',
      });
    }

    // Attach audit trail if available
    const auditTrail = AuditLog.findByOrderId(id);

    return res.status(200).json({
      success: true,
      order: {
        ...order,
        auditTrail,
      },
    });
  } catch (err) {
    console.error('Error fetching order details:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve order details.',
    });
  }
};

/**
 * POST /api/orders
 * Create order with verified payment verification, stock checks, and persisted snapshots
 */
exports.createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      id,
      items,
      shippingAddress,
      appliedCoupon,
      couponDiscount,
      paymentMethod = 'Cash on Delivery',
      paymentStatus: clientPaymentStatus,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      totalAmount,
      totalMRP,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Order must contain at least one item.',
      });
    }

    // Server-side Payment Verification: Never trust a client-submitted payment-success flag!
    const isCod =
      paymentMethod.toLowerCase().includes('cash on delivery') ||
      paymentMethod.toLowerCase().includes('cod');

    let verifiedPaymentStatus = 'Pending';

    if (isCod) {
      verifiedPaymentStatus = 'Pending';
    } else {
      // Online payment (Razorpay / UPI / Card / Net Banking)
      // Never trust client-side claims alone: verify proof via HMAC SHA256 if gateway keys are configured
      if (razorpay_payment_id && razorpay_order_id) {
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (keySecret && !keySecret.includes('placeholder')) {
          if (razorpay_signature) {
            const body = `${razorpay_order_id}|${razorpay_payment_id}`;
            const expectedSig = crypto
              .createHmac('sha256', keySecret)
              .update(body.toString())
              .digest('hex');
            verifiedPaymentStatus = expectedSig === razorpay_signature ? 'Paid' : 'Pending';
          } else {
            verifiedPaymentStatus = 'Pending';
          }
        } else {
          // In local test/mock sandbox environment
          verifiedPaymentStatus = 'Paid';
        }
      } else {
        // If no payment proof provided, online order is created in Pending payment state
        verifiedPaymentStatus = 'Pending';
      }
    }

    const order = Order.create({
      id,
      userId,
      items,
      shippingAddress,
      appliedCoupon,
      couponDiscount,
      paymentMethod,
      paymentStatus: verifiedPaymentStatus,
      totalAmount,
      totalMRP,
      actor: {
        type: 'USER',
        userId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    // Automatically trigger real order confirmation notification
    try {
      await NotificationService.sendOrderConfirmation(userId, order);
    } catch (notifErr) {
      console.warn('Failed to send order confirmation notification:', notifErr.message);
    }

    RecommendationService.clearCache(userId);
    try { realtimeService.notifyOrderUpdate(userId, order.id, order.status, order.paymentStatus); } catch (e) {}

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully.',
      order,
    });
  } catch (err) {
    console.error('Error creating order:', err);
    return res.status(err.message && err.message.includes('Insufficient stock') ? 400 : 500).json({
      success: false,
      error: err.message || 'Failed to place order.',
    });
  }
};

/**
 * POST /api/orders/:id/cancel
 * Cancel order with eligibility verification and duplicate protection
 */
exports.cancelOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { reason = 'Cancelled by user' } = req.body;

    const result = Order.cancelOrder(id, userId, reason, {
      type: 'USER',
      userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (!result.success) {
      return res.status(result.code || 400).json({
        success: false,
        error: result.error,
      });
    }

    // Trigger notification
    try {
      await NotificationService.sendShippingUpdate(userId, id, 'Cancelled');
    } catch (e) {
      console.warn('Cancel notification notice:', e.message);
    }

    RecommendationService.clearCache(userId);

    return res.status(200).json({
      success: true,
      message: `Order #${id} was cancelled successfully.`,
      order: result.order,
    });
  } catch (err) {
    console.error('Error cancelling order:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to cancel order.',
    });
  }
};

/**
 * POST /api/orders/:id/return
 * Request Return or Exchange with eligibility, 14-day window and duplicate checks
 */
exports.returnOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const {
      actionType = 'return',
      reason = 'Size/fit issue',
      exchangeSize = null,
    } = req.body;

    const result = Order.returnOrder(
      id,
      userId,
      { actionType, reason, exchangeSize },
      {
        type: 'USER',
        userId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    if (!result.success) {
      return res.status(result.code || 400).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: `${actionType === 'exchange' ? 'Exchange' : 'Return'} request submitted successfully. Pickup scheduled in 1-2 business days.`,
      order: result.order,
    });
  } catch (err) {
    console.error('Error processing return/exchange:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to process return request.',
    });
  }
};

/**
 * POST /api/orders/:id/reorder
 * Validate stock/price/variants and add available items to user bag (does NOT charge)
 */
exports.reorder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = Order.reorder(id, userId, {
      type: 'USER',
      userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (!result.success) {
      return res.status(result.code || 400).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: `${result.summary.addedCount} item(s) added to your shopping bag.`,
      summary: result.summary,
      bag: result.bag,
    });
  } catch (err) {
    console.error('Error executing reorder:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to reorder items.',
    });
  }
};

/**
 * GET /api/orders/:id/invoice
 * Download or view verified invoice PDF or structured JSON
 */
exports.getInvoice = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const format = req.query.format || (req.headers.accept?.includes('application/pdf') ? 'pdf' : 'json');

    const order = Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: `Order #${id} not found.`,
      });
    }

    // Server-side authorization check
    if (!order.userId || order.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You cannot access invoices for orders that do not belong to you.',
      });
    }

    if (format === 'pdf') {
      return await InvoiceService.generatePdf(order, res);
    } else if (format === 'html') {
      res.setHeader('Content-Type', 'text/html');
      return res.send(InvoiceService.generateHtml(order));
    }

    // Default JSON response
    const invoiceData = InvoiceService.getInvoiceData(order);
    return res.status(200).json({
      success: true,
      invoice: invoiceData,
      downloadUrl: `/api/orders/${id}/invoice?format=pdf`,
    });
  } catch (err) {
    console.error('Error generating invoice:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate invoice. Please try again later.',
    });
  }
};

/**
 * GET /api/orders/:id/audit-trail
 * Get audit trail logs for an order
 */
exports.getAuditTrail = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const order = Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: `Order #${id} not found.`,
      });
    }

    if (!order.userId || order.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to view audit records for this order.',
      });
    }

    const logs = AuditLog.findByOrderId(id);
    return res.status(200).json({
      success: true,
      orderId: id,
      auditTrail: logs,
    });
  } catch (err) {
    console.error('Error fetching audit trail:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit trail.',
    });
  }
};

/**
 * PATCH /api/orders/:id/status
 * Admin / System update order status (Shipped, Out for Delivery, Delivered)
 */
exports.updateOrderStatus = async (req, res) => {
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
        error: `Order #${id} not found.`,
      });
    }

    // Enforce strict authorization: Only order owner or admin can update order status
    if (existingOrder.userId && existingOrder.userId !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You are not authorized to update another user\'s order.',
      });
    }

    const updated = Order.updateStatus(id, status, {
      type: req.user ? 'USER' : 'SYSTEM',
      userId: req.user?.id || null,
      ip: req.ip,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: `Order ${id} not found.`,
      });
    }

    // Trigger real shipping / delivery notification to user
    try {
      await NotificationService.sendShippingUpdate(updated.userId, id, status);
    } catch (notifErr) {
      console.warn('Failed to send shipping notification:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status}.`,
      order: updated,
    });
  } catch (err) {
    console.error('Error updating order status:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to update order status.',
    });
  }
};
