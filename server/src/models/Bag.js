const db = require('../db');
const Product = require('./Product');
const sqliteCart = require('../db/sqlite');
const realtimeService = require('../services/realtimeService');

class Bag {
  static getBagRaw(userId) {
    if (!userId) return [];
    return sqliteCart.getCartItems(userId);
  }

  static getSavedRaw(userId) {
    if (!userId) return [];
    return sqliteCart.getSavedItems(userId);
  }

  /**
   * Fetch active bag items with live catalogue data, availability flags, stock checks, and trusted backend calculations
   */
  static getBagWithProducts(userId) {
    const rawItems = this.getBagRaw(userId);
    const data = db.read();
    const allProducts = data.products || [];
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    let totalMRP = 0;
    let subtotal = 0;
    let totalItems = 0;
    let hasOutOfStockItems = false;
    let hasPriceChanges = false;
    const stockWarnings = [];

    const items = rawItems
      .map((item) => {
        const product = productMap.get(item.productId);
        if (!product) {
          // Product was removed or discontinued from catalogue
          hasOutOfStockItems = true;
          stockWarnings.push(`Item "${item.productId}" is discontinued or no longer available.`);
          return {
            id: item.id || `item_${item.productId}_${item.size || 'default'}`,
            productId: item.productId,
            product: {
              id: item.productId,
              name: 'Unavailable Product',
              brand: 'Unknown',
              price: item.savedPrice || 0,
              originalPrice: item.savedPrice || 0,
              discountPercent: 0,
              image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518',
              inStock: false,
              stockCount: 0,
            },
            size: item.size || 'M',
            color: item.color || 'Default',
            quantity: item.quantity || 1,
            unitPrice: item.savedPrice || 0,
            originalUnitPrice: item.savedPrice || 0,
            subtotal: 0,
            itemMRP: 0,
            isAvailable: false,
            isOutOfStock: true,
            isDiscontinued: true,
            availableStock: 0,
            maxQuantity: 0,
            quantityExceedsStock: true,
            variantAvailable: false,
            priceChanged: false,
            savedPrice: item.savedPrice || 0,
          };
        }

        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        const availableStock = product.inStock !== false ? Number(product.stockCount ?? 10) : 0;
        const isOutOfStock = product.inStock === false || availableStock <= 0;
        const variantAvailable = Array.isArray(product.sizes) && product.sizes.length > 0
          ? product.sizes.includes(item.size)
          : true;
        const isAvailable = !isOutOfStock && variantAvailable;
        const maxQuantity = Math.min(10, Math.max(0, availableStock));
        const quantityExceedsStock = qty > availableStock;

        if (isOutOfStock) {
          hasOutOfStockItems = true;
          stockWarnings.push(`"${product.name}" is currently out of stock.`);
        } else if (quantityExceedsStock) {
          stockWarnings.push(`"${product.name}" has only ${availableStock} unit(s) remaining (requested: ${qty}).`);
        }

        const trustedPrice = Number(product.price);
        const trustedOriginalPrice = Number(product.originalPrice || product.price);
        const itemMRP = trustedOriginalPrice * qty;
        const itemSellingPrice = trustedPrice * qty;

        const priceChanged = item.savedPrice !== undefined && Number(item.savedPrice) !== trustedPrice;
        if (priceChanged) {
          hasPriceChanges = true;
        }

        if (isAvailable && !quantityExceedsStock) {
          totalMRP += itemMRP;
          subtotal += itemSellingPrice;
          totalItems += qty;
        }

        return {
          id: item.id || `item_${item.productId}_${item.size || 'default'}`,
          productId: item.productId,
          product,
          size: item.size || (product.sizes && product.sizes[0]) || 'M',
          color: item.color || (product.colors && product.colors[0]) || 'Standard',
          quantity: qty,
          unitPrice: trustedPrice,
          originalUnitPrice: trustedOriginalPrice,
          subtotal: itemSellingPrice,
          itemMRP,
          isAvailable,
          isOutOfStock,
          isDiscontinued: false,
          availableStock,
          maxQuantity,
          quantityExceedsStock,
          variantAvailable,
          priceChanged,
          priceDiff: item.savedPrice !== undefined ? trustedPrice - Number(item.savedPrice) : 0,
          savedPrice: item.savedPrice !== undefined ? Number(item.savedPrice) : trustedPrice,
        };
      })
      .filter(Boolean);

    const discountAmount = Math.max(0, totalMRP - subtotal);
    // Free shipping threshold at ₹999 or ₹99 standard
    const deliveryFee = subtotal >= 999 || totalItems === 0 ? 0 : 99;
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
      totals: {
        totalMRP,
        subtotal,
        discountAmount,
        deliveryFee,
        finalTotal,
        hasOutOfStockItems,
        hasPriceChanges,
        stockWarnings,
      },
      hasOutOfStockItems,
      hasPriceChanges,
      stockWarnings,
    };
  }

  /**
   * Fetch saved for later items with live product data, availability, and price change detection
   */
  static getSavedForLaterWithProducts(userId) {
    const rawSaved = this.getSavedRaw(userId);
    const data = db.read();
    const allProducts = data.products || [];
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    const items = rawSaved
      .map((item) => {
        const product = productMap.get(item.productId);
        if (!product) {
          return {
            id: item.id || `saved_${item.productId}_${item.size || 'default'}`,
            productId: item.productId,
            product: {
              id: item.productId,
              name: 'Unavailable Product',
              brand: 'Unknown',
              price: item.savedPrice || 0,
              originalPrice: item.savedPrice || 0,
              discountPercent: 0,
              image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518',
              inStock: false,
              stockCount: 0,
            },
            size: item.size || 'M',
            color: item.color || 'Default',
            quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
            unitPrice: item.savedPrice || 0,
            originalUnitPrice: item.savedPrice || 0,
            isAvailable: false,
            isOutOfStock: true,
            isDiscontinued: true,
            availableStock: 0,
            variantAvailable: false,
            priceChanged: false,
            priceDiff: 0,
            savedPrice: item.savedPrice || 0,
            savedAt: item.savedAt || new Date().toISOString(),
          };
        }

        const availableStock = product.inStock !== false ? Number(product.stockCount ?? 10) : 0;
        const isOutOfStock = product.inStock === false || availableStock <= 0;
        const variantAvailable = Array.isArray(product.sizes) && product.sizes.length > 0
          ? product.sizes.includes(item.size)
          : true;
        const isAvailable = !isOutOfStock && variantAvailable;
        const trustedPrice = Number(product.price);
        const trustedOriginalPrice = Number(product.originalPrice || product.price);
        const savedPrice = item.savedPrice !== undefined ? Number(item.savedPrice) : trustedPrice;
        const priceChanged = savedPrice !== trustedPrice;
        const priceDiff = trustedPrice - savedPrice;

        return {
          id: item.id || `saved_${item.productId}_${item.size || 'default'}`,
          productId: item.productId,
          product,
          size: item.size || (product.sizes && product.sizes[0]) || 'M',
          color: item.color || (product.colors && product.colors[0]) || 'Default',
          quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
          unitPrice: trustedPrice,
          originalUnitPrice: trustedOriginalPrice,
          isAvailable,
          isOutOfStock,
          isDiscontinued: false,
          availableStock,
          variantAvailable,
          priceChanged,
          priceDiff,
          savedPrice,
          savedAt: item.savedAt || new Date().toISOString(),
        };
      })
      .filter(Boolean);

    return {
      items,
      count: items.length,
    };
  }

  /**
   * Add item to active shopping bag with stock and variant validation
   */
  static addItem(userId, { productId, size, color, quantity = 1 }) {
    if (!userId || !productId) {
      return { error: 'User ID and Product ID are required.' };
    }

    const cleanProdId = productId.trim();
    const product = Product.findById(cleanProdId);

    if (!product) {
      return { error: `Product not found with ID: ${cleanProdId}` };
    }

    const availableStock = product.inStock !== false ? Number(product.stockCount ?? 10) : 0;
    if (product.inStock === false || availableStock <= 0) {
      return { error: `Product "${product.name}" is currently out of stock.` };
    }

    const availableSizes = product.sizes && product.sizes.length > 0 ? product.sizes : ['Free Size'];
    const chosenSize = size ? size.trim() : availableSizes[0];
    if (product.sizes && product.sizes.length > 0 && !product.sizes.includes(chosenSize)) {
      return {
        error: `Selected size "${chosenSize}" is not available. Available sizes: ${product.sizes.join(', ')}`,
      };
    }

    const availableColors = product.colors && product.colors.length > 0 ? product.colors : ['Standard'];
    const chosenColor = color ? color.trim() : availableColors[0];
    const addQty = Math.max(1, parseInt(quantity, 10) || 1);

    if (addQty > availableStock) {
      return {
        error: `Only ${availableStock} unit(s) available in stock. Cannot add ${addQty}.`,
      };
    }

    try {
      sqliteCart.addItem(userId, {
        productId: cleanProdId,
        size: chosenSize,
        color: chosenColor,
        quantity: addQty,
        price: product.price,
        availableStock,
      });

      realtimeService.notifyCartUpdate(userId);
      return this.getBagWithProducts(userId);
    } catch (err) {
      return { error: err.message };
    }
  }

  /**
   * Update quantity or variant of a cart item with stock validation
   */
  static updateItem(userId, itemIdOrProdId, { quantity, size, color }) {
    if (!userId || !itemIdOrProdId) {
      return { error: 'Invalid update request: missing identifiers.' };
    }

    const target = itemIdOrProdId.trim();
    const rawItems = sqliteCart.getCartItems(userId);
    const currentItem = rawItems.find((i) => i.id === target || i.productId === target);

    if (!currentItem) {
      return { error: 'Item not found in your bag.' };
    }

    const product = Product.findById(currentItem.productId);
    if (!product) {
      return { error: 'Product is no longer available in catalogue.' };
    }

    const availableStock = product.inStock !== false ? Number(product.stockCount ?? 10) : 0;

    if (quantity !== undefined) {
      const q = parseInt(quantity, 10);
      if (q <= 0) {
        sqliteCart.removeItem(userId, currentItem.id);
        realtimeService.notifyCartUpdate(userId);
        return this.getBagWithProducts(userId);
      }

      if (product.inStock === false || availableStock <= 0) {
        return { error: `"${product.name}" is currently out of stock.` };
      }

      if (q > availableStock) {
        return { error: `Requested quantity (${q}) exceeds available stock (${availableStock}).` };
      }

      if (q > 10) {
        return { error: 'Maximum purchase limit is 10 units per item.' };
      }
    }

    let cleanSize;
    if (size && size.trim() !== currentItem.size) {
      cleanSize = size.trim();
      if (product.sizes && product.sizes.length > 0 && !product.sizes.includes(cleanSize)) {
        return { error: `Size "${cleanSize}" is not available for this product.` };
      }
    }

    try {
      sqliteCart.updateItem(userId, currentItem.id, {
        quantity: quantity !== undefined ? parseInt(quantity, 10) : undefined,
        size: cleanSize,
        color: color ? color.trim() : undefined,
        availableStock,
      });

      realtimeService.notifyCartUpdate(userId);
      return this.getBagWithProducts(userId);
    } catch (err) {
      return { error: err.message };
    }
  }

  /**
   * Remove item from active shopping bag
   */
  static removeItem(userId, itemIdOrProdId) {
    if (!userId || !itemIdOrProdId) {
      return { error: 'Invalid remove request.' };
    }

    const removed = sqliteCart.removeItem(userId, itemIdOrProdId.trim());
    if (!removed) {
      return { error: 'Item not found in bag.' };
    }

    realtimeService.notifyCartUpdate(userId);
    const bagWithProducts = this.getBagWithProducts(userId);
    return {
      success: true,
      message: 'Item removed from bag.',
      removedItem: removed,
      ...bagWithProducts,
      bag: bagWithProducts,
    };
  }

  /**
   * Clear all items from user's shopping bag
   */
  static clearBag(userId) {
    if (!userId) return { error: 'User ID is required.' };
    sqliteCart.clearCart(userId);
    realtimeService.notifyCartUpdate(userId);
    const bagWithProducts = this.getBagWithProducts(userId);
    return {
      success: true,
      message: 'Bag cleared successfully.',
      ...bagWithProducts,
      bag: bagWithProducts,
    };
  }

  /**
   * Move an item from active bag into Save for Later atomically
   */
  static saveForLater(userId, itemIdOrProdId) {
    if (!userId || !itemIdOrProdId) {
      return { error: 'User ID and Item ID are required.' };
    }

    try {
      const movedItem = sqliteCart.saveForLater(userId, itemIdOrProdId.trim());
      realtimeService.notifyCartUpdate(userId);
      return {
        success: true,
        message: 'Item moved to Save for Later.',
        movedItem,
        bag: this.getBagWithProducts(userId),
        savedForLater: this.getSavedForLaterWithProducts(userId),
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  /**
   * Move an item from Save for Later back into active bag with stock, variant, and price revalidation
   */
  static moveToCart(userId, itemIdOrProdId) {
    if (!userId || !itemIdOrProdId) {
      return { error: 'User ID and Item ID are required.' };
    }

    const target = itemIdOrProdId.trim();
    const rawSaved = sqliteCart.getSavedItems(userId);
    const saved = rawSaved.find((s) => s.id === target || s.productId === target);

    if (!saved) {
      return { error: 'Item not found in Save for Later.' };
    }

    const product = Product.findById(saved.productId);
    if (!product) {
      return { error: 'This product is no longer available in the catalogue.' };
    }

    const availableStock = product.inStock !== false ? Number(product.stockCount ?? 10) : 0;
    if (product.inStock === false || availableStock <= 0) {
      return { error: `"${product.name}" is currently out of stock and cannot be moved to bag.` };
    }

    if (product.sizes && product.sizes.length > 0 && !product.sizes.includes(saved.size)) {
      return { error: `Size "${saved.size}" is no longer available for "${product.name}".` };
    }

    try {
      const movedItem = sqliteCart.moveToCart(userId, saved.id, availableStock);
      realtimeService.notifyCartUpdate(userId);
      return {
        success: true,
        message: 'Item moved to shopping bag.',
        movedItem,
        bag: this.getBagWithProducts(userId),
        savedForLater: this.getSavedForLaterWithProducts(userId),
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  /**
   * Remove item from Save for Later list
   */
  static removeSavedItem(userId, itemIdOrProdId) {
    if (!userId || !itemIdOrProdId) {
      return { error: 'Invalid remove request.' };
    }

    const removed = sqliteCart.removeSavedItem(userId, itemIdOrProdId.trim());
    if (!removed) {
      return { error: 'Item not found in Save for Later.' };
    }

    realtimeService.notifyCartUpdate(userId);
    return {
      success: true,
      message: 'Item removed from Save for Later.',
      savedForLater: this.getSavedForLaterWithProducts(userId),
    };
  }

  /**
   * Atomic merge of guest cart & guest saved-for-later items on user login
   */
  static mergeGuestCart(userId, { cartItems = [], savedForLaterItems = [] }) {
    if (!userId) {
      return { error: 'User ID is required for merge.' };
    }

    try {
      sqliteCart.mergeGuestCart(userId, { cartItems, savedForLaterItems });
      realtimeService.notifyCartUpdate(userId);
      return {
        success: true,
        message: 'Guest items merged successfully.',
        bag: this.getBagWithProducts(userId),
        savedForLater: this.getSavedForLaterWithProducts(userId),
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  /**
   * Pre-checkout validation of active cart:
   * Validates stock, availability, prices, and ensures no saved-for-later items are in cart
   */
  static validateCart(userId) {
    const bagResult = this.getBagWithProducts(userId);
    const issues = [];

    for (const item of bagResult.items) {
      if (item.isDiscontinued) {
        issues.push({
          type: 'DISCONTINUED',
          itemId: item.id,
          productId: item.productId,
          productName: item.product.name,
          message: `"${item.product.name}" is no longer available.`,
        });
      } else if (item.isOutOfStock) {
        issues.push({
          type: 'OUT_OF_STOCK',
          itemId: item.id,
          productId: item.productId,
          productName: item.product.name,
          message: `"${item.product.name}" is currently out of stock.`,
        });
      } else if (item.quantityExceedsStock) {
        issues.push({
          type: 'STOCK_EXCEEDED',
          itemId: item.id,
          productId: item.productId,
          productName: item.product.name,
          availableStock: item.availableStock,
          requestedQuantity: item.quantity,
          message: `Only ${item.availableStock} unit(s) available for "${item.product.name}".`,
        });
      } else if (!item.variantAvailable) {
        issues.push({
          type: 'VARIANT_UNAVAILABLE',
          itemId: item.id,
          productId: item.productId,
          productName: item.product.name,
          size: item.size,
          message: `Size "${item.size}" is no longer available for "${item.product.name}".`,
        });
      }

      if (item.priceChanged) {
        issues.push({
          type: 'PRICE_CHANGED',
          itemId: item.id,
          productId: item.productId,
          productName: item.product.name,
          oldPrice: item.savedPrice,
          currentPrice: item.unitPrice,
          message: `Price for "${item.product.name}" changed from ₹${item.savedPrice} to ₹${item.unitPrice}.`,
        });
      }
    }

    return {
      valid: issues.filter((i) => i.type !== 'PRICE_CHANGED').length === 0,
      hasPriceChanges: bagResult.hasPriceChanges,
      issues,
      bag: bagResult,
    };
  }
}

module.exports = Bag;
