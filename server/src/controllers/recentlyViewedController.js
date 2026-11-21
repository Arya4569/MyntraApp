const RecentlyViewed = require('../models/RecentlyViewed');
const RecommendationService = require('../services/recommendationService');
const realtimeService = require('../services/realtimeService');

exports.getRecentlyViewed = (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const result = RecentlyViewed.getRecentlyViewedWithProducts(userId, limit);
    return res.status(200).json({
      success: true,
      productIds: result.productIds,
      products: result.products,
      count: result.count,
    });
  } catch (err) {
    console.error('Error fetching recently viewed:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch recently viewed products.',
    });
  }
};

exports.addItem = (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'productId is required.',
      });
    }

    const result = RecentlyViewed.add(userId, productId);
    if (result && result.error) {
      return res.status(404).json({
        success: false,
        error: result.error,
      });
    }

    RecommendationService.clearCache(userId);

    // Broadcast browsing-history update to all connected sessions for this user
    try {
      realtimeService.notifyRecentlyViewedUpdate(userId, result);
    } catch (rtErr) {
      console.warn('Realtime notifyRecentlyViewedUpdate error:', rtErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Product tracked in recently viewed.',
      productIds: result.productIds,
      products: result.products,
      count: result.count,
    });
  } catch (err) {
    console.error('Error adding product to recently viewed:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to record recently viewed product.',
    });
  }
};

exports.syncBatch = (req, res) => {
  try {
    const userId = req.user.id;
    const { productIds } = req.body;

    if (!Array.isArray(productIds)) {
      return res.status(400).json({
        success: false,
        error: 'productIds array is required.',
      });
    }

    const result = RecentlyViewed.merge(userId, productIds);
    RecommendationService.clearCache(userId);

    // Broadcast synchronized browsing-history update to all connected sessions
    try {
      realtimeService.notifyRecentlyViewedUpdate(userId, result);
    } catch (rtErr) {
      console.warn('Realtime notifyRecentlyViewedUpdate error:', rtErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Recently viewed products synchronized successfully.',
      productIds: result.productIds,
      products: result.products,
      count: result.count,
    });
  } catch (err) {
    console.error('Error syncing recently viewed products:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync recently viewed products.',
    });
  }
};

exports.clear = (req, res) => {
  try {
    const userId = req.user.id;
    const result = RecentlyViewed.clear(userId);
    RecommendationService.clearCache(userId);

    // Broadcast clear event to all sessions
    try {
      realtimeService.notifyRecentlyViewedUpdate(userId, result);
    } catch (rtErr) {
      console.warn('Realtime notifyRecentlyViewedUpdate error:', rtErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Recently viewed products cleared successfully.',
      productIds: result.productIds,
      products: result.products,
      count: result.count,
    });
  } catch (err) {
    console.error('Error clearing recently viewed products:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear recently viewed products.',
    });
  }
};
