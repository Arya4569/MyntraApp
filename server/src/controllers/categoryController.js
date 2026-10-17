const Category = require('../models/Category');

exports.getAll = (req, res) => {
  try {
    const categories = Category.findAll();
    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (err) {
    console.error('Error fetching categories:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch categories.',
    });
  }
};

exports.getById = (req, res) => {
  try {
    const category = Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        error: `Category not found with ID: ${req.params.id}`,
      });
    }
    return res.status(200).json({
      success: true,
      category,
    });
  } catch (err) {
    console.error('Error fetching category by ID:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch category.',
    });
  }
};

exports.getProducts = (req, res) => {
  try {
    const category = Category.findById(req.params.id);
    const categoryId = req.params.id;

    // Even if category is 'all' or a valid category name, return matching products
    const products = Category.findProducts(categoryId, {
      search: req.query.search || req.query.q,
      sortBy: req.query.sortBy,
    });

    return res.status(200).json({
      success: true,
      categoryId,
      categoryName: category ? category.name : categoryId,
      count: products.length,
      products,
    });
  } catch (err) {
    console.error('Error fetching products by category:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch products for category.',
    });
  }
};

const db = require('../db');

exports.getSubcategories = (req, res) => {
  try {
    const data = db.read();
    return res.status(200).json({
      success: true,
      subcategories: data.subcategories || {},
      categoryBanners: data.categoryBanners || {},
    });
  } catch (err) {
    console.error('Error fetching subcategories:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch subcategories',
    });
  }
};
