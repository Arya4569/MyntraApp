const db = require('../db');
const Product = require('./Product');

class Bag {
  static getBagRaw(userId) {
    if (!userId) return [];
    const data = db.read();
    const bags = data.bags || {};
    return bags[userId] || [];
  }

  static getBagWithProducts(userId) {
    const rawItems = this.getBagRaw(userId);
    const data = db.read();
    const allProducts = data.products || [];
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    let totalMRP = 0;
    let subtotal = 0;
    let totalItems = 0;

    const items = rawItems
      .map((item) => {
        const product = productMap.get(item.productId);
        if (!product) return null;

        const qty = Math.max(1, item.quantity || 1);
        const originalPrice = product.originalPrice || product.price;
        const itemMRP = originalPrice * qty;
        const itemPrice = product.price * qty;

        totalMRP += itemMRP;
        subtotal += itemPrice;
        totalItems += qty;

        return {
          id: item.id || `item_${item.productId}_${item.size || 'default'}`,
          productId: item.productId,
          product,
          size: item.size || (product.sizes && product.sizes[0]) || 'M',
          color: item.color || (product.colors && product.colors[0]) || 'Default',
          quantity: qty,
        };
      })
      .filter(Boolean);

    const discountAmount = Math.max(0, totalMRP - subtotal);
    const deliveryFee = subtotal === 0 || subtotal >= 999 ? 0 : 99;
    const finalTotal = subtotal + deliveryFee;

    return {
      items,
      count: totalItems,
      lineItemsCount: items.length,
      totalMRP,
      subtotal,
      discountAmount,
      deliveryFee,
      finalTotal,
    };
  }

  static addItem(userId, { productId, size, color, quantity = 1 }) {
    if (!userId || !productId) {
      return { error: 'User ID and Product ID are required.' };
    }

    const cleanProdId = productId.trim();
    const product = Product.findById(cleanProdId);

    if (!product) {
      return { error: `Product not found with ID: ${cleanProdId}` };
    }

    if (product.inStock === false) {
      return { error: 'This product is currently out of stock.' };
    }

    const availableSizes = product.sizes || ['M'];
    const chosenSize = size ? size.trim() : availableSizes[0];
    const chosenColor = color ? color.trim() : (product.colors && product.colors[0]) || 'Standard';
    const addQty = Math.max(1, parseInt(quantity, 10) || 1);

    const data = db.read();
    if (!data.bags) data.bags = {};
    const userBag = data.bags[userId] || [];

    // Check for duplicate product + size variant
    const existingIndex = userBag.findIndex(
      (item) => item.productId === cleanProdId && item.size === chosenSize
    );

    if (existingIndex > -1) {
      // Update quantity of existing line
      const currentQty = userBag[existingIndex].quantity || 1;
      const newQty = Math.min(10, currentQty + addQty);
      userBag[existingIndex].quantity = newQty;
      if (color) userBag[existingIndex].color = chosenColor;
    } else {
      // Add new item
      userBag.push({
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        productId: cleanProdId,
        size: chosenSize,
        color: chosenColor,
        quantity: Math.min(10, addQty),
      });
    }

    data.bags[userId] = userBag;
    db.write(data);

    return this.getBagWithProducts(userId);
  }

  static updateItem(userId, itemIdOrProdId, { quantity, size }) {
    if (!userId || !itemIdOrProdId) {
      return { error: 'Invalid update request.' };
    }

    const target = itemIdOrProdId.trim();
    const data = db.read();
    if (!data.bags) data.bags = {};
    let userBag = data.bags[userId] || [];

    // Match by item.id OR item.productId
    const index = userBag.findIndex(
      (item) => item.id === target || item.productId === target
    );

    if (index === -1) {
      return { error: 'Item not found in your bag.' };
    }

    if (quantity !== undefined) {
      const q = parseInt(quantity, 10);
      if (q <= 0) {
        // Remove item if quantity is zero or less
        userBag = userBag.filter((_, i) => i !== index);
      } else {
        userBag[index].quantity = Math.min(10, q);
      }
    }

    if (size) {
      userBag[index].size = size.trim();
    }

    data.bags[userId] = userBag;
    db.write(data);

    return this.getBagWithProducts(userId);
  }

  static removeItem(userId, itemIdOrProdId) {
    if (!userId || !itemIdOrProdId) {
      return { error: 'Invalid remove request.' };
    }

    const target = itemIdOrProdId.trim();
    const data = db.read();
    if (!data.bags) data.bags = {};
    const userBag = data.bags[userId] || [];

    data.bags[userId] = userBag.filter(
      (item) => item.id !== target && item.productId !== target
    );
    db.write(data);

    return this.getBagWithProducts(userId);
  }

  static clearBag(userId) {
    if (!userId) return null;
    const data = db.read();
    if (!data.bags) data.bags = {};
    data.bags[userId] = [];
    db.write(data);

    return this.getBagWithProducts(userId);
  }
}

module.exports = Bag;
