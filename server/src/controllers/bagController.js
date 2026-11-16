const Bag = require('../models/Bag');
const RecommendationService = require('../services/recommendationService');

/**
 * Helper to build standard totals object
 */
const buildTotals = (result) => ({
  totalMRP: result.totalMRP || 0,
  subtotal: result.subtotal || 0,
  discountAmount: result.discountAmount || 0,
  deliveryFee: result.deliveryFee || 0,
  finalTotal: result.finalTotal || 0,
  count: result.count || 0,
  lineItemsCount: result.lineItemsCount || (result.items ? result.items.length : 0),
});

/**
 * GET /api/bag
 * Fetch active bag items with trusted recalculations, availability flags, and stock warnings
 */
exports.getBag = (req, res) => {
  try {
    const userId = req.user.id;
    const result = Bag.getBagWithProducts(userId);
    const totals = buildTotals(result);

    return res.status(200).json({
      success: true,
      items: result.items,
      cart: result.items,
      count: result.count,
      lineItemsCount: result.lineItemsCount,
      totalMRP: result.totalMRP,
      subtotal: result.subtotal,
      discountAmount: result.discountAmount,
      deliveryFee: result.deliveryFee,
      finalTotal: result.finalTotal,
      totals,
      hasOutOfStockItems: result.hasOutOfStockItems,
      hasPriceChanges: result.hasPriceChanges,
      stockWarnings: result.stockWarnings,
      savedForLaterCount: result.savedForLaterCount,
    });
  } catch (err) {
    console.error('Error fetching bag:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch bag.',
    });
  }
};

/**
 * POST /api/bag/items
 * Add product to active bag with variant and stock validation
 */
exports.addItem = (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, size, color, quantity } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'productId is required.',
      });
    }

    const result = Bag.addItem(userId, { productId, size, color, quantity });
    if (result && result.error) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    RecommendationService.clearCache(userId);

    const totals = buildTotals(result);

    return res.status(201).json({
      success: true,
      message: 'Item added to bag successfully.',
      items: result.items,
      cart: result.items,
      count: result.count,
      lineItemsCount: result.lineItemsCount,
      totalMRP: result.totalMRP,
      subtotal: result.subtotal,
      discountAmount: result.discountAmount,
      deliveryFee: result.deliveryFee,
      finalTotal: result.finalTotal,
      totals,
      hasOutOfStockItems: result.hasOutOfStockItems,
      hasPriceChanges: result.hasPriceChanges,
      stockWarnings: result.stockWarnings,
      savedForLaterCount: result.savedForLaterCount,
    });
  } catch (err) {
    console.error('Error adding item to bag:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to add item to bag.',
    });
  }
};

/**
 * PATCH or PUT /api/bag/items/:productId
 * Update item quantity or variant in active bag with stock limits
 */
exports.updateItem = (req, res) => {
  try {
    const userId = req.user.id;
    const itemIdOrProdId = req.params.productId || req.body.itemId || req.body.productId;
    const { quantity, size, color } = req.body;

    const result = Bag.updateItem(userId, itemIdOrProdId, { quantity, size, color });
    if (result && result.error) {
      const isNotFound = result.error.includes('not found');
      return res.status(isNotFound ? 404 : 400).json({
        success: false,
        error: result.error,
      });
    }

    const totals = buildTotals(result);

    return res.status(200).json({
      success: true,
      message: 'Bag item updated successfully.',
      items: result.items,
      cart: result.items,
      count: result.count,
      lineItemsCount: result.lineItemsCount,
      totalMRP: result.totalMRP,
      subtotal: result.subtotal,
      discountAmount: result.discountAmount,
      deliveryFee: result.deliveryFee,
      finalTotal: result.finalTotal,
      totals,
      hasOutOfStockItems: result.hasOutOfStockItems,
      hasPriceChanges: result.hasPriceChanges,
      stockWarnings: result.stockWarnings,
      savedForLaterCount: result.savedForLaterCount,
    });
  } catch (err) {
    console.error('Error updating bag item:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to update bag item.',
    });
  }
};

/**
 * DELETE /api/bag/items/:productId
 * Remove item from active bag
 */
exports.removeItem = (req, res) => {
  try {
    const userId = req.user.id;
    const itemIdOrProdId = req.params.productId || req.body.itemId || req.body.productId;

    const result = Bag.removeItem(userId, itemIdOrProdId);
    if (result && result.error) {
      const isNotFound = result.error.includes('not found');
      return res.status(isNotFound ? 404 : 400).json({
        success: false,
        error: result.error,
      });
    }

    const totals = buildTotals(result);

    return res.status(200).json({
      success: true,
      message: 'Item removed from bag.',
      items: result.items,
      cart: result.items,
      count: result.count,
      lineItemsCount: result.lineItemsCount,
      totalMRP: result.totalMRP,
      subtotal: result.subtotal,
      discountAmount: result.discountAmount,
      deliveryFee: result.deliveryFee,
      finalTotal: result.finalTotal,
      totals,
      hasOutOfStockItems: result.hasOutOfStockItems,
      hasPriceChanges: result.hasPriceChanges,
      stockWarnings: result.stockWarnings,
      savedForLaterCount: result.savedForLaterCount,
    });
  } catch (err) {
    console.error('Error removing item from bag:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove item from bag.',
    });
  }
};

/**
 * DELETE /api/bag
 * Clear all items in active bag
 */
exports.clearBag = (req, res) => {
  try {
    const userId = req.user.id;
    const result = Bag.clearBag(userId);
    const totals = {
      totalMRP: 0,
      subtotal: 0,
      discountAmount: 0,
      deliveryFee: 0,
      finalTotal: 0,
      count: 0,
      lineItemsCount: 0,
    };

    return res.status(200).json({
      success: true,
      message: 'Bag cleared successfully.',
      items: [],
      cart: [],
      count: 0,
      lineItemsCount: 0,
      totalMRP: 0,
      subtotal: 0,
      discountAmount: 0,
      deliveryFee: 0,
      finalTotal: 0,
      totals,
      savedForLaterCount: result ? result.savedForLaterCount : 0,
    });
  } catch (err) {
    console.error('Error clearing bag:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear bag.',
    });
  }
};

/**
 * POST /api/bag/items/:productId/save-for-later or POST /api/bag/save-for-later
 * Move item from active bag to Save for Later
 */
exports.saveForLater = (req, res) => {
  try {
    const userId = req.user.id;
    const itemIdOrProdId = req.params.productId || req.body.itemId || req.body.productId;

    if (!itemIdOrProdId) {
      return res.status(400).json({
        success: false,
        error: 'itemId or productId is required.',
      });
    }

    const result = Bag.saveForLater(userId, itemIdOrProdId);
    if (result && result.error) {
      return res.status(404).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      movedItem: result.movedItem,
      bag: result.bag,
      cart: result.bag ? result.bag.items : [],
      savedForLater: result.savedForLater ? result.savedForLater.items : [],
      savedForLaterDetails: result.savedForLater,
    });
  } catch (err) {
    console.error('Error saving item for later:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to move item to Save for Later.',
    });
  }
};

/**
 * GET /api/bag/saved-for-later
 * Fetch all saved for later items with live stock and current price
 */
exports.getSavedForLater = (req, res) => {
  try {
    const userId = req.user.id;
    const result = Bag.getSavedForLaterWithProducts(userId);
    return res.status(200).json({
      success: true,
      items: result.items,
      savedForLater: result.items,
      count: result.count,
    });
  } catch (err) {
    console.error('Error fetching saved for later:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch saved for later items.',
    });
  }
};

/**
 * POST /api/bag/saved-for-later/:productId/move-to-bag or POST /api/bag/move-to-cart
 * Move item from Save for Later back to active bag with stock & price revalidation
 */
exports.moveToCart = (req, res) => {
  try {
    const userId = req.user.id;
    const itemIdOrProdId = req.params.productId || req.body.itemId || req.body.productId;

    if (!itemIdOrProdId) {
      return res.status(400).json({
        success: false,
        error: 'itemId or productId is required.',
      });
    }

    const result = Bag.moveToCart(userId, itemIdOrProdId);
    if (result && result.error) {
      const isNotFound = result.error.includes('not found');
      return res.status(isNotFound ? 404 : 400).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      bag: result.bag,
      cart: result.bag ? result.bag.items : [],
      savedForLater: result.savedForLater ? result.savedForLater.items : [],
      savedForLaterDetails: result.savedForLater,
    });
  } catch (err) {
    console.error('Error moving item to bag:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to move item to bag.',
    });
  }
};

/**
 * DELETE /api/bag/saved-for-later/:productId or DELETE /api/bag/saved-for-later
 * Remove item from Save for Later
 */
exports.removeSavedItem = (req, res) => {
  try {
    const userId = req.user.id;
    const itemIdOrProdId = req.params.productId || req.body.itemId || req.body.productId;

    if (!itemIdOrProdId) {
      return res.status(400).json({
        success: false,
        error: 'itemId or productId is required.',
      });
    }

    const result = Bag.removeSavedItem(userId, itemIdOrProdId);
    if (result && result.error) {
      const isNotFound = result.error.includes('not found');
      return res.status(isNotFound ? 404 : 400).json({
        success: false,
        error: result.error,
      });
    }
    return res.status(200).json({
      success: true,
      message: result.message,
      savedForLater: result.savedForLater ? result.savedForLater.items : [],
      items: result.savedForLater ? result.savedForLater.items : [],
      savedForLaterDetails: result.savedForLater,
    });
  } catch (err) {
    console.error('Error removing saved item:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove saved item.',
    });
  }
};

/**
 * POST /api/bag/merge
 * Atomic guest cart and saved items merge endpoint upon user login
 */
exports.mergeGuestItems = (req, res) => {
  try {
    const userId = req.user.id;
    const { cartItems = [], savedForLaterItems = [] } = req.body;

    const result = Bag.mergeGuestCart(userId, { cartItems, savedForLaterItems });
    if (result && result.error) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      bag: result.bag,
      cart: result.bag ? result.bag.items : [],
      savedForLater: result.savedForLater ? result.savedForLater.items : [],
      savedForLaterDetails: result.savedForLater,
    });
  } catch (err) {
    console.error('Error merging guest bag items:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to merge guest bag items.',
    });
  }
};

/**
 * GET /api/bag/validate
 * Pre-checkout cart verification: confirms all items are available and returns price difference notices
 */
exports.validateCart = (req, res) => {
  try {
    const userId = req.user.id;
    const result = Bag.validateCart(userId);
    return res.status(200).json({
      success: true,
      isValid: result.valid,
      valid: result.valid,
      hasPriceChanges: result.hasPriceChanges,
      issues: result.issues,
      bag: result.bag,
    });
  } catch (err) {
    console.error('Error validating bag:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate bag.',
    });
  }
};
