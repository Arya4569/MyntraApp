const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/send-otp', authController.sendOtp);
router.post('/relay-email', authController.relayEmail);
router.post('/otp-login', authController.otpLogin);
router.post('/reset-password', authController.resetPassword);
router.post('/send-sms', authController.sendSms);
router.post('/logout', optionalAuth, authController.logout);

// Protected routes
router.get('/me', requireAuth, authController.getMe);
router.put('/profile', requireAuth, authController.updateProfile);
router.get('/preferences', requireAuth, authController.getPreferences);
router.put('/preferences', requireAuth, authController.updatePreferences);
router.patch('/preferences', requireAuth, authController.updatePreferences);

module.exports = router;
