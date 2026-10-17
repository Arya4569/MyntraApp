const db = require('../db');

class Category {
  static findAll() {
    const data = db.read();
    return data.categories || [];
  }

  static findById(id) {
    if (!id) return null;
    const clean = id.trim().toLowerCase();
    const categories = this.findAll();
    return (
      categories.find(
        (c) => c.id.toLowerCase() === clean || c.name.toLowerCase() === clean
      ) || null
    );
  }

  static findProducts(categoryId, options = {}) {
    const data = db.read();
    let products = data.products || [];

    const clean = (categoryId || '').trim().toLowerCase();
    if (clean && clean !== 'all') {
      products = products.filter(
        (p) =>
          (p.categoryId && p.categoryId.toLowerCase() === clean) ||
          (p.category && p.category.toLowerCase() === clean)
      );
    }

    if (options.search) {
      const q = options.search.trim().toLowerCase();
      products = products.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.subcategory && p.subcategory.toLowerCase().includes(q))
      );
    }

    if (options.sortBy) {
      switch (options.sortBy) {
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
    }

    return products;
  }
}

module.exports = Category;
