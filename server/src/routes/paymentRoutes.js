const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { optionalAuth } = require('../middleware/auth');

// Get Razorpay public key ID
router.get('/key', paymentController.getKey);

// Create a new Razorpay payment order
router.post('/create-order', optionalAuth, paymentController.createOrder);

// Verify HMAC SHA256 payment signature
router.post('/verify', optionalAuth, paymentController.verifyPayment);

// Record payment failure
router.post('/fail', optionalAuth, paymentController.failPayment);

// Record payment cancellation
router.post('/cancel', optionalAuth, paymentController.cancelPayment);

// Render responsive checkout page for mobile web sessions
router.get('/checkout/:orderId', paymentController.renderCheckoutPage);

// Handle Razorpay payment webhook
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
