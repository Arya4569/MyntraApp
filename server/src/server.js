const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env if present
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const homeRoutes = require('./routes/homeRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const bagRoutes = require('./routes/bagRoutes');
const offerRoutes = require('./routes/offerRoutes');
const couponRoutes = require('./routes/couponRoutes');
const insiderRoutes = require('./routes/insiderRoutes');
const searchRoutes = require('./routes/searchRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const recentlyViewedRoutes = require('./routes/recentlyViewedRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const orderRoutes = require('./routes/orderRoutes');
const addressRoutes = require('./routes/addressRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const realtimeRoutes = require('./routes/realtimeRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS with optional CLIENT_URL restriction or wildcard
const clientUrl = process.env.CLIENT_URL;
const allowedOrigins = clientUrl && clientUrl !== '*'
  ? clientUrl.split(',').map((u) => u.trim())
  : '*';

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging in development
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`
    );
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Myntra Backend API',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/bag', bagRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/insider', insiderRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/recently-viewed', recentlyViewedRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/realtime', realtimeRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error occurred.',
  });
});

// Start listening if run directly
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(`🚀 Myntra Backend API running on port ${PORT}`);
    console.log(`📡 Local:      http://localhost:${PORT}`);
    console.log(`🩺 Health:     http://localhost:${PORT}/api/health`);
    console.log(`🔐 Auth:       http://localhost:${PORT}/api/auth`);
    console.log(`📂 Categories: http://localhost:${PORT}/api/categories`);
    console.log(`👕 Products:   http://localhost:${PORT}/api/products`);
    console.log(`🏠 Home:       http://localhost:${PORT}/api/home`);
    console.log(`❤️ Wishlist:   http://localhost:${PORT}/api/wishlist`);
    console.log(`🛍️ Bag:        http://localhost:${PORT}/api/bag`);
    console.log(`🔔 Notifs:     http://localhost:${PORT}/api/notifications`);
    console.log(`📦 Orders:      http://localhost:${PORT}/api/orders`);
    console.log(`===============================================`);
  });
}

module.exports = app;
