const express = require('express');
const router = express.Router();
const recentlyViewedController = require('../controllers/recentlyViewedController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', recentlyViewedController.getRecentlyViewed);
router.post('/', recentlyViewedController.addItem);
router.post('/sync', recentlyViewedController.syncBatch);
router.delete('/', recentlyViewedController.clear);

module.exports = router;
