const db = require('../db');
const Product = require('../models/Product');
const Wishlist = require('../models/Wishlist');
const RecentlyViewed = require('../models/RecentlyViewed');
const Order = require('../models/Order');
const Bag = require('../models/Bag');

// Default configurable signal weights
const DEFAULT_WEIGHTS = {
  // Browsing history weights
  recentlyViewedSubcategory: 16,
  recentlyViewedCategory: 8,
  recentlyViewedBrand: 7,

  // Wishlist intent weights (very strong intent)
  wishlistSubcategory: 20,
  wishlistCategory: 10,
  wishlistBrand: 9,

  // Purchase history weights (proven buyer preference)
  orderSubcategory: 15,
  orderCategory: 8,
  orderBrand: 8,

  // Cart consideration weights
  cartSubcategory: 18,
  cartCategory: 9,
  cartBrand: 8,

  // Catalogue baseline popularity & quality signals
  ratingMultiplier: 3.5, // 4.5 star => +15.75
  bestsellerBonus: 9,
  trendingBonus: 7,
  recommendedBonus: 5,
  discountBonusMax: 5,

  // Category diversity
  maxPerSubcategory: 3,
};

// In-memory cache for high-throughput responses (TTL: 30 seconds)
const recommendationCache = new Map();
const CACHE_TTL_MS = 30 * 1000;

// Subcategories considered repeat-purchase consumables
const REPEATABLE_SUBCATEGORIES = new Set([
  'beauty',
  'skincare',
  'fragrances',
  'innerwear',
  'socks',
  'lounge wear',
  'personal care',
]);

class RecommendationService {
  /**
   * Return active ranking weights configuration
   */
  static getWeights(overrides = {}) {
    return { ...DEFAULT_WEIGHTS, ...overrides };
  }

  /**
   * Invalidate in-memory cache for a user or entirely
   */
  static clearCache(userId = null) {
    if (userId) {
      for (const key of recommendationCache.keys()) {
        if (key.startsWith(`user_${userId}`) || key.includes(userId)) {
          recommendationCache.delete(key);
        }
      }
    } else {
      recommendationCache.clear();
    }
  }

  /**
   * Main recommendation generator
   */
  static getRecommendations(options = {}) {
    const {
      userId = null,
      guestHistory = [],
      excludeProductId = null,
      limit = 10,
      category = null,
      customWeights = {},
    } = options;

    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const weights = this.getWeights(customWeights);

    // Build cache key
    const historyKey = Array.isArray(guestHistory)
      ? guestHistory.slice(0, 5).join('-')
      : String(guestHistory || '');
    const cacheKey = `${userId || 'guest'}_${excludeProductId || 'none'}_${category || 'all'}_${parsedLimit}_${historyKey}`;

    const cached = recommendationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const data = db.read();
    const allProducts = data.products || [];

    if (!allProducts.length) {
      const emptyResult = {
        success: true,
        isPersonalized: false,
        type: 'empty',
        title: 'You May Also Like',
        subtitle: 'Explore our catalog for the latest trends',
        total: 0,
        count: 0,
        products: [],
        signalsUsed: {
          browsingHistoryCount: 0,
          wishlistCount: 0,
          orderCount: 0,
          cartCount: 0,
          topCategories: [],
        },
      };
      return emptyResult;
    }

    // 1. Gather User Activity Signals
    let recentlyViewedIds = [];
    let wishlistIds = [];
    let userOrders = [];
    let cartItems = [];

    if (userId) {
      recentlyViewedIds = RecentlyViewed.getRecentlyViewedIds(userId) || [];
      wishlistIds = Wishlist.getWishlistIds(userId) || [];
      userOrders = Order.findByUserId(userId) || [];
      cartItems = Bag.getBagRaw(userId) || [];
    } else if (Array.isArray(guestHistory) && guestHistory.length > 0) {
      // Support guest browsing history (latest 50 unique)
      const cleanGuest = guestHistory
        .filter(Boolean)
        .map((id) => String(id).trim());
      recentlyViewedIds = Array.from(new Set(cleanGuest)).slice(0, 50);
    }

    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    // 2. Identify Recently Purchased Products (to exclude non-repeatable items within 30 days)
    const recentlyPurchasedExclusion = new Set();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    userOrders.forEach((order) => {
      const orderTime = new Date(order.date || order.createdAt || Date.now()).getTime();
      const isRecent = orderTime >= thirtyDaysAgo;
      const orderStatus = (order.status || '').toLowerCase();
      const isNotCancelled = !['cancelled', 'returned'].includes(orderStatus);

      if (isRecent && isNotCancelled && Array.isArray(order.items)) {
        order.items.forEach((item) => {
          const prodId = item.productId || (item.product && item.product.id);
          const fullProd = productMap.get(prodId) || item.product;
          if (fullProd) {
            const sub = (fullProd.subcategory || '').toLowerCase();
            const cat = (fullProd.category || '').toLowerCase();
            const isRepeatable =
              REPEATABLE_SUBCATEGORIES.has(sub) || REPEATABLE_SUBCATEGORIES.has(cat);
            if (!isRepeatable && prodId) {
              recentlyPurchasedExclusion.add(prodId);
            }
          }
        });
      }
    });

    // 3. Build Affinity Maps (Categories, Subcategories, Brands)
    const categoryScores = {};
    const subcategoryScores = {};
    const brandScores = {};

    const bump = (map, key, points) => {
      if (!key) return;
      const clean = String(key).trim().toLowerCase();
      map[clean] = (map[clean] || 0) + points;
    };

    // A. Browsing History affinity (up to 50 items with recency decay)
    recentlyViewedIds.slice(0, 50).forEach((id, index) => {
      const p = productMap.get(id);
      if (!p) return;
      // Exponential-like recency decay: top items have factor 1.0 down to 0.4
      const recencyFactor = Math.max(0.4, 1 - (index / 50) * 0.6);
      bump(categoryScores, p.category, weights.recentlyViewedCategory * recencyFactor);
      bump(subcategoryScores, p.subcategory, weights.recentlyViewedSubcategory * recencyFactor);
      bump(brandScores, p.brand, weights.recentlyViewedBrand * recencyFactor);
    });

    // B. Wishlist affinity
    wishlistIds.forEach((id) => {
      const p = productMap.get(id);
      if (!p) return;
      bump(categoryScores, p.category, weights.wishlistCategory);
      bump(subcategoryScores, p.subcategory, weights.wishlistSubcategory);
      bump(brandScores, p.brand, weights.wishlistBrand);
    });

    // C. Order affinity
    userOrders.forEach((order) => {
      const orderStatus = (order.status || '').toLowerCase();
      if (['cancelled', 'returned'].includes(orderStatus)) return;
      (order.items || []).forEach((item) => {
        const prod = item.product || productMap.get(item.productId);
        if (!prod) return;
        bump(categoryScores, prod.category, weights.orderCategory);
        bump(subcategoryScores, prod.subcategory, weights.orderSubcategory);
        bump(brandScores, prod.brand, weights.orderBrand);
      });
    });

    // D. Cart affinity
    cartItems.forEach((item) => {
      const prod = productMap.get(item.productId);
      if (!prod) return;
      bump(categoryScores, prod.category, weights.cartCategory);
      bump(subcategoryScores, prod.subcategory, weights.cartSubcategory);
      bump(brandScores, prod.brand, weights.cartBrand);
    });

    // Determine if user has personalized activity signals
    const totalActivitySignals =
      recentlyViewedIds.length + wishlistIds.length + userOrders.length + cartItems.length;
    const isPersonalized = totalActivitySignals > 0;

    // Set of recent items to avoid duplicate / clone behavior
    // We downweight or exclude the top 3 items already in "Recently Viewed"
    // so recommendations provide fresh discoveries and alternatives.
    const topRecentlyViewedSet = new Set(recentlyViewedIds.slice(0, 5));

    // 4. Candidate Scoring & Filtering
    const scoredCandidates = [];

    for (const p of allProducts) {
      // Filter 1: Inactive / deleted / out of stock
      const isOutOfStock =
        p.inStock === false ||
        (p.stockCount !== undefined && Number(p.stockCount) <= 0);
      if (isOutOfStock) continue;

      // Filter 2: Currently viewed product exclusion
      if (excludeProductId && p.id === excludeProductId) continue;

      // Filter 3: Recent non-repeatable purchases exclusion
      if (recentlyPurchasedExclusion.has(p.id)) continue;

      // Filter 4: Department/Category filter if requested
      if (category && category.toLowerCase() !== 'all') {
        const catClean = category.trim().toLowerCase();
        const pCat = (p.category || '').toLowerCase();
        const pCatId = (p.categoryId || '').toLowerCase();
        if (pCat !== catClean && pCatId !== catClean) continue;
      }

      // Compute Score
      let score = 0;
      const reasons = [];

      const pCat = (p.category || '').toLowerCase();
      const pSub = (p.subcategory || '').toLowerCase();
      const pBrand = (p.brand || '').toLowerCase();

      // Affinity from Wishlist
      if (subcategoryScores[pSub]) {
        score += subcategoryScores[pSub];
        if (wishlistIds.some((wid) => {
          const wp = productMap.get(wid);
          return wp && (wp.subcategory || '').toLowerCase() === pSub;
        })) {
          reasons.push('Inspired by your Wishlist styles');
        }
      }

      if (brandScores[pBrand]) {
        score += brandScores[pBrand];
        if (reasons.length === 0) {
          reasons.push(`Because you like ${p.brand}`);
        }
      }

      if (categoryScores[pCat]) {
        score += categoryScores[pCat];
      }

      // Quality & Popularity Baseline (Real Data)
      const numericRating = Number(p.rating) || 0;
      score += numericRating * weights.ratingMultiplier;

      if (p.isBestseller) {
        score += weights.bestsellerBonus;
        if (reasons.length === 0) reasons.push('Bestseller in fashion');
      }

      if (p.isTrending) {
        score += weights.trendingBonus;
        if (reasons.length === 0) reasons.push('Trending fashion pick');
      }

      if (p.isRecommended) {
        score += weights.recommendedBonus;
        if (reasons.length === 0) reasons.push('Highly recommended');
      }

      if (p.discountPercent && p.discountPercent > 0) {
        score += Math.min(weights.discountBonusMax, p.discountPercent / 15);
      }

      // Penalty for products currently in top 5 recently viewed to encourage discovery
      if (topRecentlyViewedSet.has(p.id)) {
        score -= 15;
      }

      // Default reason for cold start / unspecific
      let finalReason = reasons[0];
      if (!finalReason) {
        if (numericRating >= 4.4) {
          finalReason = `Top Rated (${numericRating.toFixed(1)} ★)`;
        } else if (p.isBestseller) {
          finalReason = 'Bestseller in catalog';
        } else if (p.isTrending) {
          finalReason = 'Trending style';
        } else {
          finalReason = 'Popular fashion pick';
        }
      }

      scoredCandidates.push({
        product: p,
        score: Math.round(score * 10) / 10,
        recommendationReason: finalReason,
        category: p.category,
        subcategory: p.subcategory,
      });
    }

    // 5. Rank and Apply Diversity Rules
    // Sort descending by score
    scoredCandidates.sort((a, b) => b.score - a.score);

    const selectedProducts = [];
    const subcategoryCountMap = {};
    const seenProductIds = new Set();

    // First pass: select top candidates respecting subcategory diversity cap
    for (const item of scoredCandidates) {
      if (seenProductIds.has(item.product.id)) continue;

      const sub = (item.subcategory || 'general').toLowerCase();
      const currentCount = subcategoryCountMap[sub] || 0;

      if (currentCount < weights.maxPerSubcategory) {
        selectedProducts.push({
          ...item.product,
          recommendationReason: item.recommendationReason,
          recommendationScore: item.score,
        });
        seenProductIds.add(item.product.id);
        subcategoryCountMap[sub] = currentCount + 1;

        if (selectedProducts.length >= parsedLimit) break;
      }
    }

    // Second pass: if diversity cap left slots open, fill remaining with highest scored
    if (selectedProducts.length < parsedLimit) {
      for (const item of scoredCandidates) {
        if (!seenProductIds.has(item.product.id)) {
          selectedProducts.push({
            ...item.product,
            recommendationReason: item.recommendationReason,
            recommendationScore: item.score,
          });
          seenProductIds.add(item.product.id);
          if (selectedProducts.length >= parsedLimit) break;
        }
      }
    }

    // Determine user top categories for transparency
    const topCategories = Object.entries(categoryScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat.charAt(0).toUpperCase() + cat.slice(1));

    const result = {
      success: true,
      isPersonalized,
      type: isPersonalized ? 'personalized' : 'trending',
      title: isPersonalized ? 'YOU MAY ALSO LIKE' : 'POPULAR & TRENDING PICKS',
      subtitle: isPersonalized
        ? 'Handpicked styles based on your browsing & preferences'
        : 'Top rated & trending styles across our fashion collection',
      total: selectedProducts.length,
      count: selectedProducts.length,
      products: selectedProducts,
      signalsUsed: {
        browsingHistoryCount: recentlyViewedIds.length,
        wishlistCount: wishlistIds.length,
        orderCount: userOrders.length,
        cartCount: cartItems.length,
        topCategories,
      },
    };

    // Cache the result
    recommendationCache.set(cacheKey, {
      timestamp: Date.now(),
      data: result,
    });

    return result;
  }

  /**
   * Get similar products for a specific product details view
   */
  static getSimilarProducts(productId, limit = 6) {
    if (!productId) return [];
    const data = db.read();
    const allProducts = data.products || [];
    const target = allProducts.find((p) => p.id === productId);
    if (!target) return [];

    const parsedLimit = Math.max(1, parseInt(limit, 10) || 6);

    const sameSub = allProducts.filter(
      (p) =>
        p.id !== target.id &&
        p.inStock !== false &&
        (p.stockCount === undefined || p.stockCount > 0) &&
        (p.category || '').toLowerCase() === (target.category || '').toLowerCase() &&
        (p.subcategory || '').toLowerCase() === (target.subcategory || '').toLowerCase()
    );

    if (sameSub.length >= parsedLimit) {
      return sameSub.slice(0, parsedLimit);
    }

    const sameCat = allProducts.filter(
      (p) =>
        p.id !== target.id &&
        p.inStock !== false &&
        (p.stockCount === undefined || p.stockCount > 0) &&
        (p.category || '').toLowerCase() === (target.category || '').toLowerCase() &&
        !sameSub.some((s) => s.id === p.id)
    );

    return [...sameSub, ...sameCat].slice(0, parsedLimit);
  }
}

module.exports = RecommendationService;
