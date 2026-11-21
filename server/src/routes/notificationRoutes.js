const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// Register and unregister device push tokens (authenticated or guest/preview)
router.post('/register-device', optionalAuth, notificationController.registerDevice);
router.post('/unregister-device', optionalAuth, notificationController.unregisterDevice);

// Notification list and unread count
router.get('/', optionalAuth, notificationController.getNotifications);
router.get('/unread-count', optionalAuth, notificationController.getUnreadCount);

// Mark read & delete (requireAuth for strict user authorization isolation)
router.patch('/read-all', requireAuth, notificationController.markAllAsRead);
router.patch('/:id/read', requireAuth, notificationController.markAsRead);
router.delete('/:id', requireAuth, notificationController.deleteNotification);

// Notification preferences (authenticated or guest sync)
router.get('/preferences', optionalAuth, notificationController.getPreferences);
router.patch('/preferences', optionalAuth, notificationController.updatePreferences);

// Promotions & test trigger endpoints
router.post('/promotions', optionalAuth, notificationController.sendPromotion);
router.post('/test-event', optionalAuth, notificationController.triggerTestEvent);

// Background scheduler inspection & trigger
router.get('/scheduler/status', notificationController.getSchedulerStatus);
router.post('/scheduler/trigger', notificationController.triggerSchedulerJob);

module.exports = router;
