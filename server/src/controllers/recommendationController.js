const RecommendationService = require('../services/recommendationService');

/**
 * GET /api/products/recommendations (or /api/recommendations)
 * Generates personalized recommendations for logged-in users or trending/popular for guests/cold-start
 */
exports.getRecommendations = (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const {
      limit,
      excludeProductId,
      currentProductId,
      guestHistory,
      category,
      categoryId,
    } = req.query;

    // Parse guest browsing history if provided
    let parsedGuestHistory = [];
    if (guestHistory) {
      if (Array.isArray(guestHistory)) {
        parsedGuestHistory = guestHistory;
      } else if (typeof guestHistory === 'string') {
        try {
          if (guestHistory.startsWith('[')) {
            parsedGuestHistory = JSON.parse(guestHistory);
          } else {
            parsedGuestHistory = guestHistory.split(',').map((s) => s.trim());
          }
        } catch {
          parsedGuestHistory = guestHistory.split(',').map((s) => s.trim());
        }
      }
    }

    const recommendations = RecommendationService.getRecommendations({
      userId,
      guestHistory: parsedGuestHistory,
      excludeProductId: excludeProductId || currentProductId || null,
      limit: limit ? parseInt(limit, 10) : 10,
      category: category || categoryId || null,
    });

    return res.status(200).json(recommendations);
  } catch (err) {
    console.error('Error generating product recommendations:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations.',
      details: err.message,
    });
  }
};

/**
 * GET /api/products/:id/similar
 * Returns styles similar to a given product for product detail screens
 */
exports.getSimilarProducts = (req, res) => {
  try {
    const { id } = req.params;
    const { limit } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required.',
      });
    }

    const similar = RecommendationService.getSimilarProducts(
      id,
      limit ? parseInt(limit, 10) : 6
    );

    return res.status(200).json({
      success: true,
      productId: id,
      count: similar.length,
      products: similar,
    });
  } catch (err) {
    console.error('Error fetching similar products:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch similar products.',
      details: err.message,
    });
  }
};

/**
 * GET /api/recommendations/weights
 * Returns the active configurable ranking weights
 */
exports.getWeights = (req, res) => {
  try {
    const weights = RecommendationService.getWeights();
    return res.status(200).json({
      success: true,
      weights,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch recommendation weights.',
    });
  }
};
