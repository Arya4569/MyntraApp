const realtimeService = require('../services/realtimeService');
const db = require('../db');
const Product = require('./Product');
const Bag = require('./Bag');
const AuditLog = require('./AuditLog');

class Order {
  /**
   * Find orders with optional filters, search, sorting and server-side pagination
   */
  static findAll(options = {}) {
    const data = db.read();
    let orders = [...(data.orders || [])];

    // 1. Filter by User ID (Enforces isolation)
    if (options.userId) {
      orders = orders.filter((o) => o.userId === options.userId);
    } else if (!options.allUsers) {
      orders = [];
    }

    // 2. Filter by Status
    if (options.status && options.status !== 'all') {
      const statusFilter = options.status.trim().toLowerCase();
      if (statusFilter === 'active') {
        orders = orders.filter((o) =>
          ['placed', 'confirmed', 'shipped', 'out for delivery'].includes(
            (o.status || '').toLowerCase()
          )
        );
      } else if (statusFilter === 'delivered') {
        orders = orders.filter((o) => (o.status || '').toLowerCase() === 'delivered');
      } else if (statusFilter === 'cancelled') {
        orders = orders.filter((o) =>
          ['cancelled', 'returned'].includes((o.status || '').toLowerCase())
        );
      } else {
        orders = orders.filter(
          (o) => (o.status || '').toLowerCase() === statusFilter
        );
      }
    }

    // 3. Filter by Date Range
    if (options.startDate || options.endDate || options.dateRange) {
      let start = options.startDate ? new Date(options.startDate).getTime() : 0;
      let end = options.endDate ? new Date(options.endDate).getTime() : Date.now();

      if (options.dateRange) {
        const now = Date.now();
        if (options.dateRange === 'last30days') {
          start = now - 30 * 24 * 60 * 60 * 1000;
        } else if (options.dateRange === 'last6months') {
          start = now - 180 * 24 * 60 * 60 * 1000;
        } else if (options.dateRange === 'thisyear' || options.dateRange === 'year') {
          const currentYear = new Date().getFullYear();
          start = new Date(`${currentYear}-01-01`).getTime();
        }
      }

      orders = orders.filter((o) => {
        const orderTime = new Date(o.date || o.createdAt).getTime();
        return orderTime >= start && orderTime <= end;
      });
    }

    // 4. Search Filter (by Order ID, product title, or brand)
    if (options.search) {
      const q = options.search.trim().toLowerCase();
      orders = orders.filter((o) => {
        const matchId = (o.id || '').toLowerCase().includes(q);
        const matchInvoice = (o.invoiceNumber || '').toLowerCase().includes(q);
        const matchItems = (o.items || []).some((item) => {
          const prod = item.product || item;
          const name = (prod.name || '').toLowerCase();
          const brand = (prod.brand || '').toLowerCase();
          return name.includes(q) || brand.includes(q);
        });
        return matchId || matchInvoice || matchItems;
      });
    }

    // 5. Sorting
    const sortBy = options.sortBy || 'date_desc';
    switch (sortBy) {
      case 'date_asc':
        orders.sort(
          (a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt)
        );
        break;
      case 'amount_desc':
        orders.sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0));
        break;
      case 'amount_asc':
        orders.sort((a, b) => (a.totalAmount || 0) - (b.totalAmount || 0));
        break;
      case 'date_desc':
      default:
        orders.sort(
          (a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)
        );
        break;
    }

    const total = orders.length;

    // 6. Server-side Pagination
    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const limit = options.limit ? Math.max(1, parseInt(options.limit, 10)) : 10;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedOrders = orders.slice(startIndex, startIndex + limit);

    return {
      orders: paginatedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  static findById(id) {
    if (!id) return null;
    const cleanId = String(id).trim();
    const data = db.read();
    const orders = data.orders || [];
    return orders.find((o) => o.id === cleanId) || null;
  }

  static findByUserId(userId) {
    if (!userId) return [];
    const res = this.findAll({ userId, limit: 1000 });
    return res.orders;
  }

  /**
   * Create order with persisted product snapshots, atomic stock updates and audit log
   */
  static create({
    id,
    userId,
    items = [],
    shippingAddress,
    appliedCoupon = null,
    couponDiscount = 0,
    paymentMethod = 'UPI / Cash on Delivery',
    paymentStatus = 'Pending',
    totalMRP,
    totalAmount,
    discountAmount,
    deliveryFee = 0,
    actor = { type: 'USER', userId },
  }) {
    if (!items || items.length === 0) {
      throw new Error('An order must contain at least one item.');
    }

    const orderId = id || `MYN-${Math.floor(100000 + Math.random() * 900000)}`;
    const invoiceNumber = `INV-${orderId}`;
    const now = new Date().toISOString();

    const deliveryDateObj = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const deliveryDateStr = deliveryDateObj.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    // 1. Snapshot and validate each item against current catalog
    const snapshottedItems = items.map((item, idx) => {
      const prod = item.product || {};
      const prodId = prod.id || item.productId;
      const liveProduct = prodId ? Product.findById(prodId) : null;

      // Persist snapshot of trusted catalog price at purchase so catalogue updates do not alter historical records
      const snapshotPrice =
        liveProduct
          ? Number(liveProduct.price)
          : item.price !== undefined
          ? Number(item.price)
          : prod.price !== undefined
          ? Number(prod.price)
          : 0;

      const snapshotOriginalPrice =
        liveProduct && liveProduct.originalPrice
          ? Number(liveProduct.originalPrice)
          : liveProduct
          ? Number(liveProduct.price)
          : item.originalPrice !== undefined
          ? Number(item.originalPrice)
          : prod.originalPrice !== undefined
          ? Number(prod.originalPrice)
          : snapshotPrice;

      const snapshotName = prod.name || (liveProduct ? liveProduct.name : 'Fashion Item');
      const snapshotBrand = prod.brand || (liveProduct ? liveProduct.brand : 'MYNTRA');
      const snapshotImage =
        prod.image ||
        (liveProduct ? liveProduct.image : 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518');

      const sellerInfo = prod.seller || (liveProduct && liveProduct.seller) || {
        name: `${snapshotBrand} Official Retail Partner`,
        fulfillmentCenter: 'Myntra Logistics Hub, Bhiwandi',
      };

      const qty = Math.max(1, Number(item.quantity) || 1);

      return {
        id: item.id || `ord_item_${Date.now()}_${idx}`,
        productId: prodId || `prod-${idx}`,
        product: {
          id: prodId,
          name: snapshotName,
          brand: snapshotBrand,
          price: snapshotPrice,
          originalPrice: snapshotOriginalPrice,
          discountPercent:
            snapshotOriginalPrice > snapshotPrice
              ? Math.round(((snapshotOriginalPrice - snapshotPrice) / snapshotOriginalPrice) * 100)
              : 0,
          image: snapshotImage,
          seller: sellerInfo,
        },
        size: item.size || 'M',
        color: item.color || 'Standard',
        quantity: qty,
        unitPrice: snapshotPrice,
        price: snapshotPrice,
        subtotal: snapshotPrice * qty,
      };
    });

    // 2. Calculate financial totals
    const calculatedMRP =
      totalMRP ||
      snapshottedItems.reduce(
        (sum, item) => sum + (item.product.originalPrice || item.product.price) * item.quantity,
        0
      );

    const calculatedSelling = snapshottedItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );

    const calculatedTotalAmount =
      totalAmount !== undefined
        ? Number(totalAmount)
        : Math.max(0, calculatedSelling - couponDiscount + deliveryFee);

    // 3. Atomically validate and decrement inventory stock inside a database transaction
    const newOrder = {
      id: orderId,
      invoiceNumber,
      userId,
      date: now,
      items: snapshottedItems,
      totalMRP: calculatedMRP,
      totalAmount: calculatedTotalAmount,
      discountAmount: discountAmount || Math.max(0, calculatedMRP - calculatedSelling),
      couponDiscount: Number(couponDiscount) || 0,
      appliedCoupon: appliedCoupon || undefined,
      deliveryFee: Number(deliveryFee) || 0,
      status: 'Confirmed',
      deliveryDate: deliveryDateStr,
      shippingAddress: shippingAddress || 'Flat 402, Sea Green Apartments, Nariman Point, Mumbai - 400001',
      paymentMethod,
      paymentStatus,
      trackingSteps: [
        { title: 'Order Confirmed', date: 'Today', completed: true, active: false },
        { title: 'Shipped from Warehouse', date: 'Expected Tomorrow', completed: false, active: true },
        { title: 'Out for Delivery', date: `By ${deliveryDateStr}`, completed: false, active: false },
        { title: 'Delivered', date: deliveryDateStr, completed: false, active: false },
      ],
      createdAt: now,
      updatedAt: now,
    };

    db.transaction((data) => {
      // Validate and decrement stock for each catalog product
      if (data.products) {
        for (const item of snapshottedItems) {
          const pIndex = data.products.findIndex((p) => p.id === item.productId);
          if (pIndex !== -1) {
            const currentStock = Number(data.products[pIndex].stockCount || 0);
            if (data.products[pIndex].inStock === false || currentStock < item.quantity) {
              throw new Error(
                `Insufficient stock for item "${item.product.name}". Only ${currentStock} unit(s) remaining.`
              );
            }
            const newStock = currentStock - item.quantity;
            data.products[pIndex].stockCount = newStock;
            data.products[pIndex].inStock = newStock > 0;
            data.products[pIndex].updatedAt = now;
          }
        }
      }

      // Prepend order
      if (!data.orders) data.orders = [];
      data.orders.unshift(newOrder);

      // Clear user bag if present
      if (data.bags && data.bags[userId]) {
        data.bags[userId] = [];
      }
    });

    // 4. Record Audit Log Entry (sanitized without card details)
    AuditLog.record({
      orderId,
      eventType: 'ORDER_CREATED',
      actor: { ...actor, userId },
      details: {
        totalAmount: calculatedTotalAmount,
        itemCount: snapshottedItems.length,
        paymentMethod,
        paymentStatus,
        shippingAddress: newOrder.shippingAddress,
      },
    });

    return newOrder;
  }

  /**
   * Update status (e.g. Shipped, Out for Delivery, Delivered)
   */
  static updateStatus(id, newStatus, actor = { type: 'SYSTEM' }) {
    const validStatuses = ['Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid order status: ${newStatus}`);
    }

    let updatedOrder = null;
    let previousStatus = null;

    db.transaction((data) => {
      const orders = data.orders || [];
      const index = orders.findIndex((o) => o.id === id);
      if (index === -1) return;

      const order = orders[index];
      previousStatus = order.status;
      const now = new Date().toISOString();

      const steps = order.trackingSteps || [
        { title: 'Order Confirmed', date: 'Today', completed: true, active: false },
        { title: 'Shipped from Warehouse', date: 'Tomorrow', completed: false, active: false },
        { title: 'Out for Delivery', date: 'Soon', completed: false, active: false },
        { title: 'Delivered', date: 'Expected Date', completed: false, active: false },
      ];

      if (newStatus === 'Shipped') {
        steps[0].completed = true;
        steps[1].completed = true;
        steps[1].active = false;
        steps[2].active = true;
      } else if (newStatus === 'Out for Delivery') {
        steps[0].completed = true;
        steps[1].completed = true;
        steps[2].completed = true;
        steps[2].active = false;
        steps[3].active = true;
      } else if (newStatus === 'Delivered') {
        steps.forEach((s) => {
          s.completed = true;
          s.active = false;
        });
        order.deliveryDate = 'Delivered Today';
      }

      order.status = newStatus;
      order.trackingSteps = steps;
      order.updatedAt = now;

      orders[index] = order;
      data.orders = orders;
      updatedOrder = order;
    });

    if (updatedOrder) {
      AuditLog.record({
        orderId: id,
        eventType: 'STATUS_CHANGED',
        actor,
        details: { previousStatus, newStatus },
      });
    }

    return updatedOrder;
  }

  /**
   * Update payment status (Pending, Paid, Failed, Cancelled, Refunded)
   */
  static updatePaymentStatus(id, paymentStatus, details = {}, actor = { type: 'SYSTEM' }) {
    const validPaymentStatuses = ['Pending', 'Paid', 'Failed', 'Cancelled', 'Refund Pending', 'Refunded'];
    if (!validPaymentStatuses.includes(paymentStatus)) {
      throw new Error(`Invalid payment status: ${paymentStatus}`);
    }

    let updatedOrder = null;
    let previousPaymentStatus = null;

    db.transaction((data) => {
      const orders = data.orders || [];
      const index = orders.findIndex((o) => o.id === id || o.id === `MYN-${id}`);
      if (index === -1) return;

      const order = orders[index];
      previousPaymentStatus = order.paymentStatus;
      const now = new Date().toISOString();

      order.paymentStatus = paymentStatus;
      if (paymentStatus === 'Paid' && (order.status === 'Placed' || order.status === 'Pending Payment')) {
        order.status = 'Confirmed';
      }
      if (details && Object.keys(details).length > 0) {
        order.paymentDetails = {
          ...(order.paymentDetails || {}),
          ...details,
          updatedAt: now,
        };
      }
      order.updatedAt = now;

      orders[index] = order;
      data.orders = orders;
      updatedOrder = order;
    });

    if (updatedOrder) {
      AuditLog.record({
        orderId: id,
        eventType: paymentStatus === 'Paid' ? 'PAYMENT_VERIFIED' : `PAYMENT_${paymentStatus.toUpperCase().replace(/\s+/g, '_')}`,
        actor,
        details: { previousPaymentStatus, newPaymentStatus: paymentStatus, ...details },
      });
    }

    return updatedOrder;
  }

  /**
   * Cancel order with server-side eligibility check, duplicate rejection, and stock restoration
   */
  static cancelOrder(id, userId, reason = 'Customer request', actor = { type: 'USER' }) {
    const order = this.findById(id);
    if (!order) {
      return { success: false, code: 404, error: `Order #${id} not found.` };
    }

    // Server-side authorization check
    if (!order.userId || order.userId !== userId) {
      return { success: false, code: 403, error: 'Unauthorized to cancel another user\'s order.' };
    }

    // Eligibility check: Cannot cancel if already Delivered, Cancelled or Returned
    if (order.status === 'Cancelled') {
      return {
        success: false,
        code: 400,
        error: `Order #${id} is already cancelled. Duplicate cancellation requests are rejected.`,
      };
    }

    if (order.status === 'Delivered') {
      return {
        success: false,
        code: 400,
        error: `Order #${id} has already been delivered. Delivered orders cannot be cancelled; please request a return or exchange.`,
      };
    }

    if (order.status === 'Returned') {
      return {
        success: false,
        code: 400,
        error: `Order #${id} has already been returned.`,
      };
    }

    let updatedOrder = null;
    const now = new Date().toISOString();

    db.transaction((data) => {
      const orders = data.orders || [];
      const index = orders.findIndex((o) => o.id === id);
      if (index === -1) return;

      const targetOrder = orders[index];
      const previousStatus = targetOrder.status;

      // Update tracking steps
      const steps = (targetOrder.trackingSteps || []).map((s) => ({ ...s, active: false }));
      steps.push({
        title: `Order Cancelled (${reason})`,
        date: 'Today',
        completed: true,
        active: false,
      });

      // Safe payment status: if paid online, mark 'Refund Pending' (do not falsely claim refund completed)
      let newPaymentStatus = targetOrder.paymentStatus;
      if (targetOrder.paymentStatus === 'Paid') {
        newPaymentStatus = 'Refund Pending';
      }

      targetOrder.status = 'Cancelled';
      targetOrder.paymentStatus = newPaymentStatus;
      targetOrder.cancelReason = reason;
      targetOrder.cancelledAt = now;
      targetOrder.trackingSteps = steps;
      targetOrder.updatedAt = now;

      // Restore inventory stock for each product in catalog
      if (data.products && Array.isArray(targetOrder.items)) {
        for (const item of targetOrder.items) {
          const pIndex = data.products.findIndex((p) => p.id === item.productId);
          if (pIndex !== -1) {
            const currentStock = Number(data.products[pIndex].stockCount || 0);
            const restoreQty = Number(item.quantity || 1);
            data.products[pIndex].stockCount = currentStock + restoreQty;
            data.products[pIndex].inStock = true;
            data.products[pIndex].updatedAt = now;
          }
        }
      }

      orders[index] = targetOrder;
      data.orders = orders;
      updatedOrder = targetOrder;
    });

    if (updatedOrder) {
      AuditLog.record({
        orderId: id,
        eventType: 'ORDER_CANCELLED',
        actor: { ...actor, userId },
        details: {
          reason,
          refundStatus: updatedOrder.paymentStatus,
          totalAmount: updatedOrder.totalAmount,
        },
      });
    }

    return { success: true, order: updatedOrder };
  }

  /**
   * Return order with server-side eligibility check, window validation and duplicate rejection
   */
  static returnOrder(
    id,
    userId,
    { actionType = 'return', reason = 'Quality or fit issue', exchangeSize = null } = {},
    actor = { type: 'USER' }
  ) {
    const order = this.findById(id);
    if (!order) {
      return { success: false, code: 404, error: `Order #${id} not found.` };
    }

    // Server-side authorization check
    if (!order.userId || order.userId !== userId) {
      return { success: false, code: 403, error: 'Unauthorized to return another user\'s order.' };
    }

    // Eligibility check 1: Only delivered orders can be returned/exchanged
    if (order.status !== 'Delivered') {
      return {
        success: false,
        code: 400,
        error: `Only delivered orders are eligible for return or exchange. Current order status: ${order.status}`,
      };
    }

    // Eligibility check 2: Prevent duplicate requests
    if (order.status === 'Returned' || order.returnRequest) {
      return {
        success: false,
        code: 400,
        error: `A return/exchange request has already been submitted for Order #${id}. Duplicate requests are rejected.`,
      };
    }

    // Eligibility check 3: 14-day policy window
    const orderDate = new Date(order.date || order.createdAt).getTime();
    const daysSinceOrder = (Date.now() - orderDate) / (1000 * 60 * 60 * 24);
    if (daysSinceOrder > 14) {
      return {
        success: false,
        code: 400,
        error: 'The 14-day return/exchange window for this order has expired.',
      };
    }

    let updatedOrder = null;
    const now = new Date().toISOString();

    db.transaction((data) => {
      const orders = data.orders || [];
      const index = orders.findIndex((o) => o.id === id);
      if (index === -1) return;

      const targetOrder = orders[index];
      const isExchange = actionType === 'exchange';

      const steps = [...(targetOrder.trackingSteps || [])];
      steps.push({
        title: isExchange
          ? `Exchange Requested (${reason}${exchangeSize ? ` - Size: ${exchangeSize}` : ''})`
          : `Return Initiated (${reason})`,
        date: 'Pickup scheduled in 1-2 business days',
        completed: true,
        active: false,
      });

      // Safe payment status: if return, set 'Refund Pending' (refund completed only upon warehouse pickup verification)
      const newPaymentStatus = !isExchange && targetOrder.paymentStatus === 'Paid'
        ? 'Refund Pending'
        : targetOrder.paymentStatus;

      targetOrder.status = 'Returned';
      targetOrder.paymentStatus = newPaymentStatus;
      targetOrder.returnRequest = {
        actionType,
        reason,
        exchangeSize: exchangeSize || null,
        requestedAt: now,
        status: 'Pickup Scheduled',
      };
      targetOrder.trackingSteps = steps;
      targetOrder.updatedAt = now;

      orders[index] = targetOrder;
      data.orders = orders;
      updatedOrder = targetOrder;
    });

    if (updatedOrder) {
      AuditLog.record({
        orderId: id,
        eventType: 'RETURN_REQUESTED',
        actor: { ...actor, userId },
        details: {
          actionType,
          reason,
          exchangeSize,
          refundStatus: updatedOrder.paymentStatus,
        },
      });
    }

    return { success: true, order: updatedOrder };
  }

  /**
   * Reorder items from an existing order into user's shopping bag
   * Checks current live catalog stock, price and variants without charging the user
   */
  static reorder(id, userId, actor = { type: 'USER' }) {
    const order = this.findById(id);
    if (!order) {
      return { success: false, code: 404, error: `Order #${id} not found.` };
    }

    if (!order.userId || order.userId !== userId) {
      return { success: false, code: 403, error: 'Unauthorized to reorder from another user\'s order.' };
    }

    const items = order.items || [];
    if (items.length === 0) {
      return { success: false, code: 400, error: 'This order has no items to reorder.' };
    }

    const addedItems = [];
    const unavailableItems = [];
    const priceChanges = [];

    for (const item of items) {
      const prodId = item.productId || (item.product && item.product.id);
      const liveProduct = Product.findById(prodId);

      if (!liveProduct) {
        unavailableItems.push({
          productId: prodId,
          name: item.product?.name || 'Product',
          reason: 'Product is no longer available in the catalogue.',
        });
        continue;
      }

      if (liveProduct.inStock === false || (liveProduct.stockCount !== undefined && liveProduct.stockCount <= 0)) {
        unavailableItems.push({
          productId: prodId,
          name: liveProduct.name,
          reason: 'Currently out of stock.',
        });
        continue;
      }

      const requestedSize = item.size || 'M';
      if (Array.isArray(liveProduct.sizes) && liveProduct.sizes.length > 0 && !liveProduct.sizes.includes(requestedSize)) {
        unavailableItems.push({
          productId: prodId,
          name: liveProduct.name,
          reason: `Size ${requestedSize} is no longer available. Available sizes: ${liveProduct.sizes.join(', ')}`,
        });
        continue;
      }

      // Detect price changes from historical order price
      const historicalPrice = item.unitPrice || item.product?.price || 0;
      if (historicalPrice && liveProduct.price !== historicalPrice) {
        priceChanges.push({
          productId: prodId,
          name: liveProduct.name,
          oldPrice: historicalPrice,
          currentPrice: liveProduct.price,
        });
      }

      // Add available product to user's cart
      Bag.addItem(userId, {
        productId: prodId,
        size: requestedSize,
        color: item.color || (liveProduct.colors && liveProduct.colors[0]) || 'Standard',
        quantity: Math.min(item.quantity || 1, liveProduct.stockCount || 10),
      });

      addedItems.push({
        productId: prodId,
        name: liveProduct.name,
        brand: liveProduct.brand,
        size: requestedSize,
        quantity: Math.min(item.quantity || 1, liveProduct.stockCount || 10),
        price: liveProduct.price,
      });
    }

    // Record Audit Log for Reorder action
    AuditLog.record({
      orderId: id,
      eventType: 'REORDER_EXECUTED',
      actor: { ...actor, userId },
      details: {
        addedCount: addedItems.length,
        unavailableCount: unavailableItems.length,
        priceChangedCount: priceChanges.length,
      },
    });

    const userBag = Bag.getBagWithProducts(userId);

    return {
      success: true,
      summary: {
        addedCount: addedItems.length,
        unavailableCount: unavailableItems.length,
        priceChangedCount: priceChanges.length,
        addedItems,
        unavailableItems,
        priceChanges,
      },
      bag: userBag,
    };
  }
}

module.exports = Order;
