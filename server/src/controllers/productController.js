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
