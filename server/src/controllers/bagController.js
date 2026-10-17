const Bag = require('../models/Bag');

exports.getBag = (req, res) => {
  try {
    const userId = req.user.id;
    const result = Bag.getBagWithProducts(userId);
    return res.status(200).json({
      success: true,
      items: result.items,
      count: result.count,
      lineItemsCount: result.lineItemsCount,
      totalMRP: result.totalMRP,
      subtotal: result.subtotal,
      discountAmount: result.discountAmount,
      deliveryFee: result.deliveryFee,
      finalTotal: result.finalTotal,
    });
  } catch (err) {
    console.error('Error fetching bag:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch bag.',
    });
  }
};

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

    return res.status(201).json({
      success: true,
      message: 'Item added to bag successfully.',
      items: result.items,
      count: result.count,
      totalMRP: result.totalMRP,
      subtotal: result.subtotal,
      discountAmount: result.discountAmount,
      deliveryFee: result.deliveryFee,
      finalTotal: result.finalTotal,
    });
  } catch (err) {
    console.error('Error adding item to bag:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to add item to bag.',
    });
  }
};

exports.updateItem = (req, res) => {
  try {
    const userId = req.user.id;
    const itemIdOrProdId = req.params.productId;
    const { quantity, size } = req.body;

    const result = Bag.updateItem(userId, itemIdOrProdId, { quantity, size });
    if (result && result.error) {
      return res.status(404).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Bag item updated.',
      items: result.items,
      count: result.count,
      totalMRP: result.totalMRP,
      subtotal: result.subtotal,
      discountAmount: result.discountAmount,
      deliveryFee: result.deliveryFee,
      finalTotal: result.finalTotal,
    });
  } catch (err) {
    console.error('Error updating bag item:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to update bag item.',
    });
  }
};

exports.removeItem = (req, res) => {
  try {
    const userId = req.user.id;
    const itemIdOrProdId = req.params.productId;

    const result = Bag.removeItem(userId, itemIdOrProdId);
    return res.status(200).json({
      success: true,
      message: 'Item removed from bag.',
      items: result.items,
      count: result.count,
      totalMRP: result.totalMRP,
      subtotal: result.subtotal,
      discountAmount: result.discountAmount,
      deliveryFee: result.deliveryFee,
      finalTotal: result.finalTotal,
    });
  } catch (err) {
    console.error('Error removing item from bag:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove item from bag.',
    });
  }
};

exports.clearBag = (req, res) => {
  try {
    const userId = req.user.id;
    const result = Bag.clearBag(userId);
    return res.status(200).json({
      success: true,
      message: 'Bag cleared successfully.',
      items: [],
      count: 0,
      totalMRP: 0,
      subtotal: 0,
      discountAmount: 0,
      deliveryFee: 0,
      finalTotal: 0,
    });
  } catch (err) {
    console.error('Error clearing bag:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear bag.',
    });
  }
};
