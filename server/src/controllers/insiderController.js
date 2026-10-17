const db = require('../db');
const jwt = require('jsonwebtoken');

/**
 * GET /api/insider
 * Get VIP Insider status, dynamic supercoins balance, and perks
 */
exports.getInsiderDetails = (req, res) => {
  try {
    const data = db.read();
    const insiderData = data.insiderData || {
      defaultPoints: 250,
      tier: 'GOLD TIER',
      tierSubtitle: 'Select Tier Member',
      pointsRule: 'Earn 10 SuperCoins for every ₹100 spent on all purchases.',
      perks: [],
    };

    let userCoins = insiderData.defaultPoints || 250;
    let userTier = insiderData.tier || 'GOLD TIER';

    // Check JWT token if available
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'myntra_super_secure_jwt_secret_key_2026');
        const user = (data.users || []).find((u) => u.id === decoded.id);
        if (user && typeof user.insiderPoints === 'number') {
          userCoins = user.insiderPoints;
          if (userCoins >= 1000) userTier = 'ICON TIER';
          else if (userCoins >= 500) userTier = 'ELITE TIER';
          else userTier = 'SELECT TIER';
        }
      } catch (jwtErr) {
        // Fall back to default
      }
    }

    return res.status(200).json({
      success: true,
      superCoins: userCoins,
      tier: userTier,
      tierSubtitle: insiderData.tierSubtitle || 'Select Tier Member',
      pointsRule: insiderData.pointsRule,
      perks: insiderData.perks || [],
    });
  } catch (err) {
    console.error('Error fetching insider details:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch insider details',
    });
  }
};
