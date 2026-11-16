const Wishlist = require('../models/Wishlist');
const RecommendationService = require('../services/recommendationService');

exports.getWishlist = (req, res) => {
  try {
    const userId = req.user.id;
    const result = Wishlist.getWishlistWithProducts(userId);
    return res.status(200).json({
      success: true,
      productIds: result.productIds,
      products: result.products,
      count: result.count,
    });
  } catch (err) {
    console.error('Error fetching wishlist:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch wishlist.',
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

    const result = Wishlist.add(userId, productId);
    if (result && result.error) {
      return res.status(404).json({
        success: false,
        error: result.error,
      });
    }

    RecommendationService.clearCache(userId);

    return res.status(200).json({
      success: true,
      message: 'Product added to wishlist successfully.',
      productIds: result.productIds,
      products: result.products,
      count: result.count,
    });
  } catch (err) {
    console.error('Error adding product to wishlist:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to add product to wishlist.',
    });
  }
};

exports.removeItem = (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'productId is required.',
      });
    }

    const result = Wishlist.remove(userId, productId);
    RecommendationService.clearCache(userId);
    return res.status(200).json({
      success: true,
      message: 'Product removed from wishlist.',
      productIds: result.productIds,
      products: result.products,
      count: result.count,
    });
  } catch (err) {
    console.error('Error removing product from wishlist:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove product from wishlist.',
    });
  }
};
