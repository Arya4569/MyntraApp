const db = require('../db');

/**
 * GET /api/offers
 * Get active bank offers and payment discounts
 */
exports.getBankOffers = (req, res) => {
  try {
    const data = db.read();
    const offers = data.bankOffers || [];
    return res.status(200).json({
      success: true,
      count: offers.length,
      offers,
    });
  } catch (err) {
    console.error('Error fetching bank offers:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch bank offers',
    });
  }
};

/**
 * GET /api/coupons
 * Get active discount coupons
 */
exports.getCoupons = (req, res) => {
  try {
    const data = db.read();
    const coupons = data.coupons || [];
    return res.status(200).json({
      success: true,
      count: coupons.length,
      coupons,
    });
  } catch (err) {
    console.error('Error fetching coupons:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch coupons',
    });
  }
};

/**
 * POST /api/coupons/validate
 * Validate and calculate coupon discount for cart amount
 */
exports.validateCoupon = (req, res) => {
  try {
    const { code, cartAmount } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Coupon code is required' });
    }

    const data = db.read();
    const coupons = data.coupons || [];
    const coupon = coupons.find((c) => c.code.toUpperCase() === code.trim().toUpperCase());

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: `Invalid coupon code "${code}".`,
      });
    }

    const orderAmount = Number(cartAmount) || 0;
    if (orderAmount < coupon.minOrder) {
      return res.status(400).json({
        success: false,
        error: `Add items worth ₹${coupon.minOrder - orderAmount} more to apply ${coupon.code}.`,
        minOrder: coupon.minOrder,
      });
    }

    let discount = 0;
    if (coupon.discountType === 'flat') {
      discount = coupon.discountValue;
    } else if (coupon.discountType === 'percentage') {
      discount = Math.round((orderAmount * coupon.discountValue) / 100);
    }

    return res.status(200).json({
      success: true,
      valid: true,
      coupon,
      discount,
      finalAmount: Math.max(0, orderAmount - discount),
    });
  } catch (err) {
    console.error('Error validating coupon:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate coupon',
    });
  }
};
