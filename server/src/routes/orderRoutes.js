const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { requireAuth } = require('../middleware/auth');

// All order operations require authenticated user
router.use(requireAuth);

// Order History with pagination & filters
router.get('/', orderController.getOrders);

// Create new order
router.post('/', orderController.createOrder);

// Single order details with persisted snapshot & authorization check
router.get('/:id', orderController.getOrderById);

// Reorder items from previous order
router.post('/:id/reorder', orderController.reorder);

// Order Cancellation
router.post('/:id/cancel', orderController.cancelOrder);

// Order Return / Exchange Request
router.post('/:id/return', orderController.returnOrder);

// Download / View Invoice PDF
router.get('/:id/invoice', orderController.getInvoice);

// Order Audit Trail
router.get('/:id/audit-trail', orderController.getAuditTrail);

// Update status (Shipped, Out for Delivery, Delivered)
router.patch('/:id/status', orderController.updateOrderStatus);

module.exports = router;
