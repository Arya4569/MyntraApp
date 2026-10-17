const express = require('express');
const router = express.Router();
const bagController = require('../controllers/bagController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', bagController.getBag);
router.post('/items', bagController.addItem);
router.patch('/items/:productId', bagController.updateItem);
router.delete('/items/:productId', bagController.removeItem);
router.delete('/', bagController.clearBag);

module.exports = router;
