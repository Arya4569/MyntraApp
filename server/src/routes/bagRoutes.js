const express = require('express');
const router = express.Router();
const bagController = require('../controllers/bagController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// 1. Core Active Bag Routes
router.get('/', bagController.getBag);
router.post('/items', bagController.addItem);
router.patch('/items/:productId', bagController.updateItem);
router.put('/items/:productId', bagController.updateItem);
router.delete('/items/:productId', bagController.removeItem);
router.delete('/', bagController.clearBag);

// 2. Pre-checkout Validation & Guest Merging
router.get('/validate', bagController.validateCart);
router.post('/merge', bagController.mergeGuestItems);

// 3. Save for Later Routes
router.post('/items/:productId/save-for-later', bagController.saveForLater);
router.post('/save-for-later', bagController.saveForLater);
router.get('/saved-for-later', bagController.getSavedForLater);
router.post('/saved-for-later/:productId/move-to-bag', bagController.moveToCart);
router.post('/move-to-cart', bagController.moveToCart);
router.delete('/saved-for-later/:productId', bagController.removeSavedItem);
router.delete('/saved-for-later', bagController.removeSavedItem);

module.exports = router;
