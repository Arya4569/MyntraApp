const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');
const { optionalAuth } = require('../middleware/auth');

// GET /api/recommendations
router.get('/', optionalAuth, recommendationController.getRecommendations);

// GET /api/recommendations/weights
router.get('/weights', recommendationController.getWeights);

// GET /api/recommendations/similar/:id
router.get('/similar/:id', recommendationController.getSimilarProducts);

module.exports = router;
