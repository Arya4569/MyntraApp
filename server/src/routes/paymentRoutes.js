const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Get Razorpay public key ID
router.get('/key', paymentController.getKey);

// Create a new Razorpay payment order
router.post('/create-order', paymentController.createOrder);

// Verify HMAC SHA256 payment signature
router.post('/verify', paymentController.verifyPayment);

module.exports = router;
