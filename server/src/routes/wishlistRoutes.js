const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', wishlistController.getWishlist);
router.post('/', wishlistController.addItem);
router.delete('/:productId', wishlistController.removeItem);

module.exports = router;
