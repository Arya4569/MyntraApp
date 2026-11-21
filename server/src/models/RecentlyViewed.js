const db = require('../db');
const Product = require('./Product');

const MAX_RECENTLY_VIEWED = 20;

class RecentlyViewed {
  static getRecentlyViewedIds(userId) {
    if (!userId) return [];
    const data = db.read();
    const map = data.recentlyViewed || {};
    return map[userId] || [];
  }

  static getRecentlyViewedWithProducts(userId, limit = MAX_RECENTLY_VIEWED) {
    const ids = this.getRecentlyViewedIds(userId);
    const data = db.read();
    const allProducts = data.products || [];
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    // Map and filter out any unavailable or deleted products
    const validProducts = [];
    const validIds = [];
    const effectiveLimit = Math.min(MAX_RECENTLY_VIEWED, Math.max(1, Number(limit) || MAX_RECENTLY_VIEWED));

    for (const id of ids) {
      const prod = productMap.get(id);
      if (prod && prod.inStock !== false) {
        validProducts.push(prod);
        validIds.push(id);
      }
    }

    return {
      productIds: validIds.slice(0, effectiveLimit),
      products: validProducts.slice(0, effectiveLimit),
      count: validProducts.slice(0, effectiveLimit).length,
    };
  }

  static add(userId, productId) {
    if (!userId || !productId) return null;
    const cleanProdId = String(productId).trim();

    // Verify product exists in database
    const product = Product.findById(cleanProdId);
    if (!product) {
      return { error: `Product not found with ID: ${cleanProdId}` };
    }

    const data = db.read();
    if (!data.recentlyViewed) data.recentlyViewed = {};
    const existing = data.recentlyViewed[userId] || [];

    // Re-viewing moves product to the top (newest first), no duplicates, max 20
    const updated = [cleanProdId, ...existing.filter((id) => id !== cleanProdId)].slice(
      0,
      MAX_RECENTLY_VIEWED
    );

    data.recentlyViewed[userId] = updated;
    db.write(data);

    return this.getRecentlyViewedWithProducts(userId);
  }

  static merge(userId, productIds = []) {
    if (!userId) return null;
    if (!Array.isArray(productIds)) {
      return this.getRecentlyViewedWithProducts(userId);
    }

    const data = db.read();
    if (!data.recentlyViewed) data.recentlyViewed = {};
    const existing = data.recentlyViewed[userId] || [];

    // Clean input product IDs
    const cleanGuestIds = productIds
      .filter(Boolean)
      .map((id) => String(id).trim());

    // Merge: Guest incoming items first (newest), followed by existing server history
    // Preserve order of first occurrence, remove duplicates, cap at MAX_RECENTLY_VIEWED
    const merged = [];
    const seen = new Set();

    for (const id of [...cleanGuestIds, ...existing]) {
      if (!seen.has(id)) {
        seen.add(id);
        merged.push(id);
        if (merged.length >= MAX_RECENTLY_VIEWED) break;
      }
    }

    data.recentlyViewed[userId] = merged;
    db.write(data);

    return this.getRecentlyViewedWithProducts(userId);
  }

  static clear(userId) {
    if (!userId) return null;
    const data = db.read();
    if (!data.recentlyViewed) data.recentlyViewed = {};
    data.recentlyViewed[userId] = [];
    db.write(data);

    return {
      productIds: [],
      products: [],
      count: 0,
    };
  }
}

module.exports = RecentlyViewed;
