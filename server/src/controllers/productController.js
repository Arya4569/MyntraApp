const Product = require('../models/Product');

exports.getAll = (req, res) => {
  try {
    const {
      category,
      categoryId,
      subcategory,
      search,
      q,
      brand,
      brands,
      sortBy,
      size,
      sizes,
      minPrice,
      maxPrice,
      minRating,
      page,
      limit,
    } = req.query;

    const parsedBrands = brands ? (Array.isArray(brands) ? brands : brands.split(',')) : undefined;
    const parsedSizes = sizes ? (Array.isArray(sizes) ? sizes : sizes.split(',')) : undefined;

    const result = Product.findAll({
      category,
      categoryId,
      subcategory,
      search: search || q,
      brand,
      brands: parsedBrands,
      sortBy,
      size,
      sizes: parsedSizes,
      minPrice,
      maxPrice,
      minRating,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      total: result.total,
      count: result.products.length,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : result.total,
      products: result.products,
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch products.',
    });
  }
};

exports.getById = (req, res) => {
  try {
    const product = Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: `Product not found with ID: ${req.params.id}`,
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (err) {
    console.error('Error fetching product by ID:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch product details.',
    });
  }
};

/**
 * PATCH /api/products/:id/price
 * Update product price and trigger Wishlist Price Drop notifications if price dropped
 */
exports.updatePrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { price } = req.body;
    const NotificationService = require('../services/notificationService');

    const result = Product.updatePrice(id, price);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: `Product not found with ID: ${id}`,
      });
    }

    let notifiedUsers = 0;
    if (result.newPrice < result.oldPrice) {
      try {
        const notifResult = await NotificationService.sendPriceDropAlert(
          id,
          result.oldPrice,
          result.newPrice
        );
        notifiedUsers = notifResult.notifiedCount || 0;
      } catch (e) {
        console.warn('Failed to send price drop notifications:', e.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Product price updated from ₹${result.oldPrice} to ₹${result.newPrice}.`,
      product: result.product,
      priceDropped: result.newPrice < result.oldPrice,
      notifiedUsers,
    });
  } catch (err) {
    console.error('Error updating product price:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to update product price.',
    });
  }
};

/**
 * PATCH /api/products/:id/stock
 * Update product stock status and trigger Back-in-Stock notifications if restocked
 */
exports.updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { inStock, stockCount } = req.body;
    const NotificationService = require('../services/notificationService');

    const result = Product.updateStock(id, inStock, stockCount);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: `Product not found with ID: ${id}`,
      });
    }

    let notifiedUsers = 0;
    // Trigger when restocked from out-of-stock
    if (!result.wasInStock && result.isInStock) {
      try {
        const notifResult = await NotificationService.sendStockAlert(id);
        notifiedUsers = notifResult.notifiedCount || 0;
      } catch (e) {
        console.warn('Failed to send stock alert notifications:', e.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Product stock status updated to ${result.isInStock ? 'In Stock' : 'Out of Stock'}.`,
      product: result.product,
      restocked: !result.wasInStock && result.isInStock,
      notifiedUsers,
    });
  } catch (err) {
    console.error('Error updating product stock:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to update product stock.',
    });
  }
};
