const db = require('../db');

class Product {
  static findAll(options = {}) {
    const data = db.read();
    let products = [...(data.products || [])];

    // Filter by Category
    const categoryTarget = options.categoryId || options.category;
    if (categoryTarget && categoryTarget.toLowerCase() !== 'all') {
      const clean = categoryTarget.trim().toLowerCase();
      products = products.filter(
        (p) =>
          (p.categoryId && p.categoryId.toLowerCase() === clean) ||
          (p.category && p.category.toLowerCase() === clean)
      );
    }

    // Filter by Subcategory
    if (options.subcategory) {
      const cleanSub = options.subcategory.trim().toLowerCase();
      products = products.filter(
        (p) => p.subcategory && p.subcategory.toLowerCase() === cleanSub
      );
    }

    // Search query
    const searchTarget = options.search || options.q;
    if (searchTarget) {
      const q = searchTarget.trim().toLowerCase();
      products = products.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.subcategory && p.subcategory.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    // Brand filter
    if (options.brand) {
      const brandClean = options.brand.trim().toLowerCase();
      products = products.filter(
        (p) => p.brand && p.brand.toLowerCase() === brandClean
      );
    } else if (Array.isArray(options.brands) && options.brands.length > 0) {
      const brandSet = new Set(options.brands.map((b) => b.trim().toLowerCase()));
      products = products.filter(
        (p) => p.brand && brandSet.has(p.brand.toLowerCase())
      );
    }

    // Price range filter
    if (options.minPrice !== undefined && !isNaN(Number(options.minPrice))) {
      products = products.filter((p) => p.price >= Number(options.minPrice));
    }
    if (options.maxPrice !== undefined && !isNaN(Number(options.maxPrice))) {
      products = products.filter((p) => p.price <= Number(options.maxPrice));
    }

    // Rating filter
    if (options.minRating !== undefined && !isNaN(Number(options.minRating))) {
      products = products.filter((p) => (p.rating || 0) >= Number(options.minRating));
    }

    // Sizes filter
    if (options.size) {
      const sizeClean = options.size.trim();
      products = products.filter(
        (p) => Array.isArray(p.sizes) && p.sizes.includes(sizeClean)
      );
    } else if (Array.isArray(options.sizes) && options.sizes.length > 0) {
      const sizeSet = new Set(options.sizes.map((s) => s.trim()));
      products = products.filter(
        (p) => Array.isArray(p.sizes) && p.sizes.some((s) => sizeSet.has(s))
      );
    }

    // Sorting
    const sortBy = options.sortBy || 'recommended';
    switch (sortBy) {
      case 'price_low_high':
        products.sort((a, b) => a.price - b.price);
        break;
      case 'price_high_low':
        products.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'newest':
        products.sort((a, b) => (b.isNewArrival ? 1 : 0) - (a.isNewArrival ? 1 : 0));
        break;
      case 'recommended':
      default:
        products.sort((a, b) => (b.isRecommended ? 1 : 0) - (a.isRecommended ? 1 : 0));
        break;
    }

    const total = products.length;

    // Pagination
    if (options.limit || options.page) {
      const page = Math.max(1, parseInt(options.page, 10) || 1);
      const limit = options.limit ? Math.max(1, parseInt(options.limit, 10)) : products.length;
      const start = (page - 1) * limit;
      products = products.slice(start, start + limit);
    }

    return { total, products };
  }

  static findById(id) {
    if (!id) return null;
    const clean = id.trim();
    const data = db.read();
    const products = data.products || [];
    return products.find((p) => p.id === clean) || null;
  }

  static findFeatured(limit = 8) {
    const data = db.read();
    const products = data.products || [];
    return products
      .filter((p) => p.isBestseller || p.isRecommended)
      .slice(0, limit);
  }

  static findTrending(limit = 8) {
    const data = db.read();
    const products = data.products || [];
    return products.filter((p) => p.isTrending).slice(0, limit);
  }

  static findDeals(limit = 8) {
    const data = db.read();
    const products = data.products || [];
    return products
      .filter((p) => p.isDealOfDay || p.discountPercent >= 50)
      .slice(0, limit);
  }
}

module.exports = Product;
