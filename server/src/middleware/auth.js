const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET =
  process.env.JWT_SECRET || 'myntra_super_secure_jwt_secret_key_2026';

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authorization token missing or invalid. Please log in.',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User associated with this token no longer exists.',
      });
    }

    req.user = User.sanitize(user);
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Your session has expired. Please log in again.',
        isExpired: true,
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token.',
    });
  }
};

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return next();
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = User.findById(decoded.id);
    if (user) {
      req.user = User.sanitize(user);
      req.token = token;
    }
  } catch (err) {
    // Silently continue for optional auth
  }
  next();
};

module.exports = {
  requireAuth,
  optionalAuth,
  JWT_SECRET,
};
