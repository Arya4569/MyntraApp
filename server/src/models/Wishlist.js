const db = require('../db');
const Product = require('./Product');

class Wishlist {
  static getWishlistIds(userId) {
    if (!userId) return [];
    const data = db.read();
    const wishlists = data.wishlists || {};
    return wishlists[userId] || [];
  }

  static getWishlistWithProducts(userId) {
    const ids = this.getWishlistIds(userId);
    const data = db.read();
    const allProducts = data.products || [];
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    const products = ids
      .map((id) => productMap.get(id))
      .filter(Boolean);

    return {
      productIds: ids,
      products,
      count: ids.length,
    };
  }

  static add(userId, productId) {
    if (!userId || !productId) return null;
    const cleanProdId = productId.trim();

    // Verify product exists in database
    const product = Product.findById(cleanProdId);
    if (!product) {
      return { error: `Product not found with ID: ${cleanProdId}` };
    }

    const data = db.read();
    if (!data.wishlists) data.wishlists = {};
    const userWishlist = data.wishlists[userId] || [];

    // Deduplicate
    if (!userWishlist.includes(cleanProdId)) {
      userWishlist.push(cleanProdId);
      data.wishlists[userId] = userWishlist;
      db.write(data);
    }

    return this.getWishlistWithProducts(userId);
  }

  static remove(userId, productId) {
    if (!userId || !productId) return null;
    const cleanProdId = productId.trim();

    const data = db.read();
    if (!data.wishlists) data.wishlists = {};
    const userWishlist = data.wishlists[userId] || [];

    data.wishlists[userId] = userWishlist.filter((id) => id !== cleanProdId);
    db.write(data);

    return this.getWishlistWithProducts(userId);
  }
}

module.exports = Wishlist;
