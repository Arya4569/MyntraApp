const db = require('../db');
const Product = require('./Product');

class Bag {
  static getBagRaw(userId) {
    if (!userId) return [];
    const data = db.read();
    const bags = data.bags || {};
    return bags[userId] || [];
  }

  static getSavedRaw(userId) {
    if (!userId) return [];
    const data = db.read();
    const saved = data.savedForLater || {};
    return saved[userId] || [];
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

        totalMRP += itemMRP;
        subtotal += itemSellingPrice;
        totalItems += qty;

        return {
          id: item.id || `item_${item.productId}_${item.size || 'default'}`,
          productId: item.productId,
          product,
          size: item.size || (product.sizes && product.sizes[0]) || 'M',
          color: item.color || (product.colors && product.colors[0]) || 'Default',
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
          savedPrice: item.savedPrice !== undefined ? Number(item.savedPrice) : trustedPrice,
        };
      })
      .filter(Boolean);

    const discountAmount = Math.max(0, totalMRP - subtotal);
    const deliveryFee = subtotal === 0 || subtotal >= 999 ? 0 : 99;
    const finalTotal = subtotal === 0 ? 0 : subtotal + deliveryFee;

    const savedRaw = this.getSavedRaw(userId);

    return {
      items,
      count: totalItems,
      lineItemsCount: items.length,
      totalMRP,
      subtotal,
      discountAmount,
      deliveryFee,
      finalTotal,
      hasOutOfStockItems,
      hasPriceChanges,
      stockWarnings,
      savedForLaterCount: savedRaw.length,
    };
  }

  /**
   * Fetch saved for later items with live product status and price changes
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
            quantity: item.quantity || 1,
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

    let resultError = null;

    db.transaction((data) => {
      if (!data.bags) data.bags = {};
      const userBag = data.bags[userId] || [];

      // Check for duplicate product + variant
      const existingIndex = userBag.findIndex(
        (item) => item.productId === cleanProdId && item.size === chosenSize
      );

      if (existingIndex > -1) {
        const currentQty = userBag[existingIndex].quantity || 1;
        const combinedQty = currentQty + addQty;

        if (combinedQty > availableStock) {
          resultError = `Cannot add more. You already have ${currentQty} in your bag and only ${availableStock} are available in stock.`;
          return;
        }

        if (combinedQty > 10) {
          resultError = 'Maximum purchase limit is 10 units per item.';
          return;
        }

        userBag[existingIndex].quantity = combinedQty;
        userBag[existingIndex].savedPrice = product.price;
        if (chosenColor) userBag[existingIndex].color = chosenColor;
      } else {
        userBag.push({
          id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          productId: cleanProdId,
          size: chosenSize,
          color: chosenColor,
          quantity: Math.min(10, addQty),
          savedPrice: product.price,
          addedAt: new Date().toISOString(),
        });
      }

      data.bags[userId] = userBag;
    });

    if (resultError) {
      return { error: resultError };
    }

    return this.getBagWithProducts(userId);
  }

  /**
   * Update quantity or variant of a cart item with stock validation
   */
  static updateItem(userId, itemIdOrProdId, { quantity, size, color }) {
    if (!userId || !itemIdOrProdId) {
      return { error: 'Invalid update request: missing identifiers.' };
    }

    const target = itemIdOrProdId.trim();
    let resultError = null;

    db.transaction((data) => {
      if (!data.bags) data.bags = {};
      let userBag = data.bags[userId] || [];

      // Prefer exact match by item.id, fallback to item.productId
      let index = userBag.findIndex((item) => item.id === target);
      if (index === -1) {
        index = userBag.findIndex((item) => item.productId === target);
      }

      if (index === -1) {
        resultError = 'Item not found in your bag.';
        return;
      }

      const currentItem = userBag[index];
      const product = (data.products || []).find((p) => p.id === currentItem.productId);

      if (!product) {
        resultError = 'Product is no longer available in catalogue.';
        return;
      }

      const availableStock = product.inStock !== false ? Number(product.stockCount ?? 10) : 0;

      if (quantity !== undefined) {
        const q = parseInt(quantity, 10);
        if (q <= 0) {
          // Remove item if quantity is zero or negative
          userBag = userBag.filter((_, i) => i !== index);
          data.bags[userId] = userBag;
          return;
        }

        if (product.inStock === false || availableStock <= 0) {
          resultError = `"${product.name}" is currently out of stock.`;
          return;
        }

        if (q > availableStock) {
          resultError = `Requested quantity (${q}) exceeds available stock (${availableStock}).`;
          return;
        }

        if (q > 10) {
          resultError = 'Maximum purchase limit is 10 units per item.';
          return;
        }

        userBag[index].quantity = q;
        userBag[index].savedPrice = product.price;
      }

      if (size && size.trim() !== currentItem.size) {
        const cleanSize = size.trim();
        if (product.sizes && product.sizes.length > 0 && !product.sizes.includes(cleanSize)) {
          resultError = `Size "${cleanSize}" is not available for this product.`;
          return;
        }

        // Check if changing to this size conflicts with an existing line item
        const duplicateIdx = userBag.findIndex(
          (item, i) => i !== index && item.productId === currentItem.productId && item.size === cleanSize
        );

        if (duplicateIdx > -1) {
          // Merge quantities into that line item
          const mergedQty = Math.min(availableStock, Math.min(10, userBag[duplicateIdx].quantity + userBag[index].quantity));
          userBag[duplicateIdx].quantity = mergedQty;
          userBag = userBag.filter((_, i) => i !== index);
        } else {
          userBag[index].size = cleanSize;
        }
      }

      if (color) {
        userBag[index].color = color.trim();
      }

      data.bags[userId] = userBag;
    });

    if (resultError) {
      return { error: resultError };
    }

    return this.getBagWithProducts(userId);
  }

  /**
   * Remove item from active shopping bag
   */
  static removeItem(userId, itemIdOrProdId) {
    if (!userId || !itemIdOrProdId) {
      return { error: 'Invalid remove request.' };
    }

    const target = itemIdOrProdId.trim();
    let found = false;

    db.transaction((data) => {
      if (!data.bags) data.bags = {};
      const userBag = data.bags[userId] || [];

      // Match by item.id first, or by productId
      const index = userBag.findIndex((item) => item.id === target || item.productId === target);
      if (index > -1) {
        found = true;
        userBag.splice(index, 1);
        data.bags[userId] = userBag;
      }
    });

    if (!found) {
      return { error: 'Item not found in bag.' };
    }

    return this.getBagWithProducts(userId);
  }

  /**
   * Clear all active bag items
   */
  static clearBag(userId) {
    if (!userId) return null;

    db.transaction((data) => {
      if (!data.bags) data.bags = {};
      data.bags[userId] = [];
    });

    return this.getBagWithProducts(userId);
  }

  /**
   * Move an item from active bag into Save for Later atomically
   */
  static saveForLater(userId, itemIdOrProdId) {
    if (!userId || !itemIdOrProdId) {
      return { error: 'User ID and Item ID are required.' };
    }

    const target = itemIdOrProdId.trim();
    let movedItem = null;
    let resultError = null;

    db.transaction((data) => {
      if (!data.bags) data.bags = {};
      if (!data.savedForLater) data.savedForLater = {};

      const userBag = data.bags[userId] || [];
      const userSaved = data.savedForLater[userId] || [];

      // Find item in bag
      let index = userBag.findIndex((item) => item.id === target);
      if (index === -1) {
        index = userBag.findIndex((item) => item.productId === target);
      }

      if (index === -1) {
        resultError = 'Item not found in your bag.';
        return;
      }

      const item = userBag[index];
      // Remove from bag
      userBag.splice(index, 1);
      data.bags[userId] = userBag;

      // Find current live price
      const product = (data.products || []).find((p) => p.id === item.productId);
      const currentPrice = product ? product.price : (item.savedPrice || 0);

      // Check if duplicate already exists in saved list
      const savedIndex = userSaved.findIndex(
        (s) => s.productId === item.productId && s.size === item.size
      );

      if (savedIndex > -1) {
        // Update quantity and timestamp
        userSaved[savedIndex].quantity = Math.min(10, (userSaved[savedIndex].quantity || 1) + (item.quantity || 1));
        userSaved[savedIndex].savedPrice = currentPrice;
        userSaved[savedIndex].savedAt = new Date().toISOString();
        movedItem = userSaved[savedIndex];
      } else {
        const newSavedItem = {
          id: `saved_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          productId: item.productId,
          size: item.size,
          color: item.color,
          quantity: item.quantity || 1,
          savedPrice: currentPrice,
          savedAt: new Date().toISOString(),
        };
        userSaved.unshift(newSavedItem);
        movedItem = newSavedItem;
      }

      data.savedForLater[userId] = userSaved;
    });

    if (resultError) {
      return { error: resultError };
    }

    return {
      success: true,
      message: 'Item moved to Save for Later.',
      movedItem,
      bag: this.getBagWithProducts(userId),
      savedForLater: this.getSavedForLaterWithProducts(userId),
    };
  }

  /**
   * Move an item from Save for Later back into active bag with stock, variant, and price revalidation
   */
  static moveToCart(userId, itemIdOrProdId) {
    if (!userId || !itemIdOrProdId) {
      return { error: 'User ID and Item ID are required.' };
    }

    const target = itemIdOrProdId.trim();
    let resultError = null;

    db.transaction((data) => {
      if (!data.bags) data.bags = {};
      if (!data.savedForLater) data.savedForLater = {};

      const userSaved = data.savedForLater[userId] || [];
      const userBag = data.bags[userId] || [];

      // Find item in saved list
      let index = userSaved.findIndex((item) => item.id === target);
      if (index === -1) {
        index = userSaved.findIndex((item) => item.productId === target);
      }

      if (index === -1) {
        resultError = 'Item not found in Save for Later.';
        return;
      }

      const savedItem = userSaved[index];
      const product = (data.products || []).find((p) => p.id === savedItem.productId);

      if (!product) {
        resultError = 'This product is no longer available in the catalogue.';
        return;
      }

      const availableStock = product.inStock !== false ? Number(product.stockCount ?? 10) : 0;
      if (product.inStock === false || availableStock <= 0) {
        resultError = `"${product.name}" is currently out of stock and cannot be moved to bag.`;
        return;
      }

      if (product.sizes && product.sizes.length > 0 && !product.sizes.includes(savedItem.size)) {
        resultError = `Size "${savedItem.size}" is no longer available for "${product.name}".`;
        return;
      }

      // Check if item already exists in active bag
      const existingBagIndex = userBag.findIndex(
        (b) => b.productId === savedItem.productId && b.size === savedItem.size
      );

      const requestedQty = savedItem.quantity || 1;

      if (existingBagIndex > -1) {
        const currentQty = userBag[existingBagIndex].quantity || 1;
        if (currentQty >= availableStock) {
          resultError = `Cannot move to bag. You already have the maximum available stock (${availableStock}) in your bag.`;
          return;
        }

        const newQty = Math.min(10, Math.min(availableStock, currentQty + requestedQty));
        userBag[existingBagIndex].quantity = newQty;
        userBag[existingBagIndex].savedPrice = product.price;
      } else {
        const initialQty = Math.min(10, Math.min(availableStock, requestedQty));
        userBag.push({
          id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          productId: savedItem.productId,
          size: savedItem.size,
          color: savedItem.color,
          quantity: initialQty,
          savedPrice: product.price,
          addedAt: new Date().toISOString(),
        });
      }

      // Remove from saved list
      userSaved.splice(index, 1);

      data.bags[userId] = userBag;
      data.savedForLater[userId] = userSaved;
    });

    if (resultError) {
      return { error: resultError };
    }

    return {
      success: true,
      message: 'Item moved back to Bag.',
      bag: this.getBagWithProducts(userId),
      savedForLater: this.getSavedForLaterWithProducts(userId),
    };
  }

  /**
   * Remove item from Save for Later
   */
  static removeSavedItem(userId, itemIdOrProdId) {
    if (!userId || !itemIdOrProdId) {
      return { error: 'Invalid remove request.' };
    }

    const target = itemIdOrProdId.trim();
    let found = false;

    db.transaction((data) => {
      if (!data.savedForLater) data.savedForLater = {};
      const userSaved = data.savedForLater[userId] || [];

      const index = userSaved.findIndex((item) => item.id === target || item.productId === target);
      if (index > -1) {
        found = true;
        userSaved.splice(index, 1);
        data.savedForLater[userId] = userSaved;
      }
    });

    if (!found) {
      return { error: 'Item not found in Save for Later.' };
    }

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

    db.transaction((data) => {
      if (!data.bags) data.bags = {};
      if (!data.savedForLater) data.savedForLater = {};

      const userBag = data.bags[userId] || [];
      const userSaved = data.savedForLater[userId] || [];
      const products = data.products || [];
      const productMap = new Map(products.map((p) => [p.id, p]));

      // 1. Merge active cart items
      for (const gItem of cartItems) {
        if (!gItem.productId) continue;
        const product = productMap.get(gItem.productId);
        if (!product) continue;

        const availableStock = product.inStock !== false ? Number(product.stockCount ?? 10) : 0;
        if (availableStock <= 0) continue;

        const chosenSize = gItem.size || (product.sizes && product.sizes[0]) || 'M';
        const chosenColor = gItem.color || (product.colors && product.colors[0]) || 'Standard';
        const addQty = Math.max(1, parseInt(gItem.quantity, 10) || 1);

        const matchIndex = userBag.findIndex(
          (u) => u.productId === gItem.productId && u.size === chosenSize
        );

        if (matchIndex > -1) {
          const currentQty = userBag[matchIndex].quantity || 1;
          userBag[matchIndex].quantity = Math.min(10, Math.min(availableStock, currentQty + addQty));
          userBag[matchIndex].savedPrice = product.price;
        } else {
          userBag.push({
            id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            productId: gItem.productId,
            size: chosenSize,
            color: chosenColor,
            quantity: Math.min(10, Math.min(availableStock, addQty)),
            savedPrice: product.price,
            addedAt: new Date().toISOString(),
          });
        }
      }

      // 2. Merge saved-for-later items
      for (const sItem of savedForLaterItems) {
        if (!sItem.productId) continue;
        const product = productMap.get(sItem.productId);
        if (!product) continue;

        const chosenSize = sItem.size || (product.sizes && product.sizes[0]) || 'M';
        const chosenColor = sItem.color || (product.colors && product.colors[0]) || 'Standard';

        const matchIndex = userSaved.findIndex(
          (s) => s.productId === sItem.productId && s.size === chosenSize
        );

        if (matchIndex > -1) {
          userSaved[matchIndex].quantity = Math.min(10, (userSaved[matchIndex].quantity || 1) + (sItem.quantity || 1));
          userSaved[matchIndex].savedPrice = product.price;
        } else {
          userSaved.push({
            id: `saved_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            productId: sItem.productId,
            size: chosenSize,
            color: chosenColor,
            quantity: Math.max(1, parseInt(sItem.quantity, 10) || 1),
            savedPrice: product.price,
            savedAt: new Date().toISOString(),
          });
        }
      }

      data.bags[userId] = userBag;
      data.savedForLater[userId] = userSaved;
    });

    return {
      success: true,
      message: 'Guest items merged successfully.',
      bag: this.getBagWithProducts(userId),
      savedForLater: this.getSavedForLaterWithProducts(userId),
    };
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
