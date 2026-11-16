const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

const { optionalAuth } = require('../middleware/auth');
const recommendationController = require('../controllers/recommendationController');

router.get('/', productController.getAll);
router.get('/recommendations', optionalAuth, recommendationController.getRecommendations);
router.get('/:id/similar', recommendationController.getSimilarProducts);
router.get('/:id', productController.getById);
router.patch('/:id/price', productController.updatePrice);
router.patch('/:id/stock', productController.updateStock);

module.exports = router;
