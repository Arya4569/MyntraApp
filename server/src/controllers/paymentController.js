const Razorpay = require('razorpay');
const crypto = require('crypto');

const getKeyId = () => process.env.RAZORPAY_KEY_ID || '';
const getKeySecret = () => process.env.RAZORPAY_KEY_SECRET || '';

const getRazorpayInstance = () => {
  const keyId = getKeyId();
  const keySecret = getKeySecret();
  if (keyId && keySecret && !keyId.includes('placeholder')) {
    try {
      return new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    } catch (err) {
      console.warn('Failed to initialize Razorpay instance:', err);
    }
  }
  return null;
};

/**
 * GET /api/payment/key
 * Returns public key_id for client-side checkout initialization
 */
exports.getKey = (req, res) => {
  const instance = getRazorpayInstance();
  return res.status(200).json({
    success: true,
    keyId: getKeyId() || 'rzp_test_placeholder',
    isLiveConfigured: Boolean(instance),
  });
};

/**
 * POST /api/payment/create-order
 * Body: { amount: number (in INR rupees), receipt?: string }
 */
exports.createOrder = async (req, res) => {
  try {
    const { amount, receipt } = req.body;
    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'A valid order amount is required.',
      });
    }

    // Razorpay amount in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(numericAmount * 100);
    const orderReceipt = receipt || `rcpt_${Date.now()}`;
    const instance = getRazorpayInstance();

    if (instance) {
      const order = await instance.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: orderReceipt,
      });

      return res.status(200).json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: getKeyId(),
        isLive: true,
      });
    }

    // Fallback sandbox test order if API keys are yet to be configured in .env
    const sandboxOrderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return res.status(200).json({
      success: true,
      orderId: sandboxOrderId,
      amount: amountInPaise,
      currency: 'INR',
      keyId: getKeyId() || 'rzp_test_placeholder',
      isLive: false,
      sandbox: true,
      message: 'Razorpay Sandbox Mode: Add RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET to .env for real gateway transactions.',
    });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to create Razorpay payment order.',
    });
  }
};

/**
 * POST /api/payment/verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
exports.verifyPayment = (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id) {
      return res.status(400).json({
        success: false,
        error: 'Order ID and Payment ID are required for verification.',
      });
    }

    const keySecret = getKeySecret();
    const instance = getRazorpayInstance();

    // If live credentials not configured yet, verify sandbox test payment
    if (!instance || !keySecret) {
      return res.status(200).json({
        success: true,
        verified: true,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        sandbox: true,
      });
    }

    // Official Razorpay HMAC SHA256 Signature Verification
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      return res.status(200).json({
        success: true,
        verified: true,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
      });
    } else {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Payment verification failed: Invalid transaction signature.',
      });
    }
  } catch (err) {
    console.error('Error verifying Razorpay payment:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error verifying payment.',
    });
  }
};
