const db = require('../db');

/**
 * GET /api/search/popular
 * Get trending search queries and popular categories
 */
exports.getPopularSearches = (req, res) => {
  try {
    const data = db.read();
    return res.status(200).json({
      success: true,
      popularCategories: data.popularCategories || [],
      trendingSearches: data.trendingSearches || [],
    });
  } catch (err) {
    console.error('Error fetching popular searches:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch popular searches',
    });
  }
};
