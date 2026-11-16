const http = require('http');
const app = require('./src/server');
const db = require('./src/db');
const Product = require('./src/models/Product');
const RecentlyViewed = require('./src/models/RecentlyViewed');
const Wishlist = require('./src/models/Wishlist');
const Order = require('./src/models/Order');
const RecommendationService = require('./src/services/recommendationService');

const PORT = 5095;
let server;

const request = (path, method = 'GET', body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(responseBody),
          });
        } catch {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
};

const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
};

async function runTests() {
  try {
    console.log('============================================================');
    console.log('🧪 RUNNING TASK 6: PERSONALIZED RECOMMENDATION SYSTEM TESTS');
    console.log('============================================================\n');

    // 1. Authenticate Demo User (User A)
    console.log('--- 1. Authentication & Setup ---');
    const loginRes = await request('/api/auth/login', 'POST', {
      identifier: '9876543210',
      password: 'Password123!',
    });
    assert(loginRes.status === 200 && loginRes.data.token, 'Demo user login succeeds');
    const tokenA = loginRes.data.token;
    const userA = loginRes.data.user;

    // Register a clean test user (User ColdStart) with zero history
    const uniqueEmail = `coldstart_${Date.now()}@fashion.dev`;
    const testMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const regRes = await request('/api/auth/register', 'POST', {
      fullName: 'Cold Start User',
      email: uniqueEmail,
      mobileNumber: testMobile,
      password: 'Password123!',
      confirmPassword: 'Password123!',
      gender: 'Women',
      termsAccepted: true,
    });
    assert(regRes.status === 201 && regRes.data.token, 'Cold start user registered');
    const coldToken = regRes.data.token;
    const coldUser = regRes.data.user;

    // --- 2. Cold-Start Handling for New / Logged-out User ---
    console.log('\n--- 2. Cold-Start Handling (New User / Logged-Out) ---');
    const coldRecsRes = await request('/api/recommendations?limit=8', 'GET', null, coldToken);
    assert(coldRecsRes.status === 200, 'Cold-start GET /api/recommendations returns 200');
    assert(coldRecsRes.data.success === true, 'Response marked success');
    assert(coldRecsRes.data.isPersonalized === false, 'Cold-start isPersonalized is false');
    assert(coldRecsRes.data.type === 'trending', 'Cold-start type is trending/popular');
    assert(coldRecsRes.data.products.length > 0, 'Cold-start returns non-empty real products');
    assert(coldRecsRes.data.products.length <= 8, 'Respects limit parameter (<= 8)');
    assert(
      coldRecsRes.data.products.every((p) => p.inStock !== false),
      'All cold-start products are in-stock'
    );
    assert(
      coldRecsRes.data.products.every((p) => typeof p.price === 'number' && p.price > 0),
      'All recommended products have valid prices'
    );

    // Unauthenticated Guest Cold Start (no query params)
    const guestColdRes = await request('/api/recommendations?limit=6');
    assert(guestColdRes.status === 200, 'Guest without history returns 200');
    assert(guestColdRes.data.isPersonalized === false, 'Guest is marked not personalized');
    assert(guestColdRes.data.products.length === 6, 'Guest receives requested 6 trending products');

    // --- 3. Guest Browsing Personalization ---
    console.log('\n--- 3. Guest Browsing History Personalization ---');
    // Guest browsed sneakers ('prod-2') and casual shirt ('prod-1')
    const guestHistory = ['prod-2', 'prod-1'];
    const guestRecsRes = await request(
      `/api/recommendations?guestHistory=${guestHistory.join(',')}&limit=6`
    );
    assert(guestRecsRes.status === 200, 'Guest with browsing history returns 200');
    assert(guestRecsRes.data.isPersonalized === true, 'Guest with history is marked personalized');
    assert(
      guestRecsRes.data.signalsUsed.browsingHistoryCount === 2,
      'Captured 2 guest browsing history signals'
    );
    assert(
      guestRecsRes.data.products.length > 0,
      'Guest personalized recommendations returned'
    );

    // --- 4. Logged-in User Personalization (Browsing + Wishlist + Orders) ---
    console.log('\n--- 4. Logged-in User Personalization with Weighted Signals ---');
    // User A has demo wishlist ('prod-1', 'prod-3') and order history
    const userARecsRes = await request('/api/recommendations?limit=10', 'GET', null, tokenA);
    assert(userARecsRes.status === 200, 'User A recommendations return 200');
    assert(userARecsRes.data.isPersonalized === true, 'User A recommendations are personalized');
    assert(
      userARecsRes.data.signalsUsed.wishlistCount >= 1,
      'User A signals include wishlist items'
    );
    assert(
      userARecsRes.data.products.some((p) => p.recommendationReason),
      'Recommended products include clear recommendationReason'
    );

    // --- 5. Product Filtering: Out-of-Stock and Deleted Items Exclusion ---
    console.log('\n--- 5. Product Filtering (Out of Stock & Inactive Exclusion) ---');
    // Temporarily mark a product out of stock
    const testOosProdId = 'prod-6';
    Product.updateStock(testOosProdId, false, 0);
    RecommendationService.clearCache();

    const oosCheckRes = await request('/api/recommendations?limit=30', 'GET', null, tokenA);
    assert(oosCheckRes.status === 200, 'GET recommendations succeeds after stock change');
    const containsOos = oosCheckRes.data.products.some((p) => p.id === testOosProdId);
    assert(!containsOos, `Out of stock product (${testOosProdId}) is excluded from recommendations`);

    // Restore stock
    Product.updateStock(testOosProdId, true, 25);
    RecommendationService.clearCache();

    // --- 6. Currently Viewed Product Exclusion ---
    console.log('\n--- 6. Currently Viewed Product Exclusion ---');
    const viewedProdId = 'prod-1';
    const excludeRes = await request(
      `/api/recommendations?excludeProductId=${viewedProdId}&limit=10`,
      'GET',
      null,
      tokenA
    );
    assert(excludeRes.status === 200, 'GET recommendations with excludeProductId returns 200');
    assert(
      !excludeRes.data.products.some((p) => p.id === viewedProdId),
      `Currently viewed product (${viewedProdId}) is strictly excluded`
    );

    // --- 7. Deduplication & Uniqueness ---
    console.log('\n--- 7. Deduplication & Unique Results ---');
    const recList = userARecsRes.data.products;
    const seenIds = new Set();
    let hasDuplicates = false;
    for (const p of recList) {
      if (seenIds.has(p.id)) {
        hasDuplicates = true;
        break;
      }
      seenIds.add(p.id);
    }
    assert(!hasDuplicates, 'Zero duplicate products in recommendation response');

    // --- 8. Recent Purchase Exclusion ---
    console.log('\n--- 8. Recent Purchase Exclusion ---');
    // Check if non-repeatable recently purchased product is excluded
    // Demo order #MYN-582910 contains prod-1
    // Request recommendations without excludeProductId
    RecommendationService.clearCache(userA.id);
    const orderExclusionRes = await request('/api/recommendations?limit=15', 'GET', null, tokenA);
    // prod-1 was purchased yesterday (within 30 days) and is non-repeatable (shirt)
    const containsRecentPurchase = orderExclusionRes.data.products.some((p) => p.id === 'prod-1');
    assert(
      !containsRecentPurchase,
      'Recently purchased non-repeatable item (prod-1) is excluded from recommendations'
    );

    // --- 9. Guest-to-Login History Merging & Isolation ---
    console.log('\n--- 9. Guest-to-Login Merge & Cross-User Isolation ---');
    // Guest browsed prod-7, prod-8 before logging into Cold Start account
    const guestBatch = ['prod-7', 'prod-8'];
    const mergeRvRes = await request(
      '/api/recently-viewed/sync',
      'POST',
      { productIds: guestBatch },
      coldToken
    );
    assert(mergeRvRes.status === 200, 'Guest browsing history merged into account');

    // Now Cold Start account recommendations should be personalized using merged history
    const mergedRecsRes = await request('/api/recommendations?limit=6', 'GET', null, coldToken);
    assert(
      mergedRecsRes.data.isPersonalized === true,
      'Merged account recommendations are now personalized'
    );
    assert(
      mergedRecsRes.data.signalsUsed.browsingHistoryCount >= 2,
      'Merged account reflects 2+ browsing history signals'
    );

    // Check isolation: Cold user cannot see User A wishlist or private orders
    assert(
      mergedRecsRes.data.signalsUsed.orderCount === 0,
      'Cold user orderCount is 0 (User A orders NOT leaked)'
    );

    // --- 10. Direct Similar Products Endpoint ---
    console.log('\n--- 10. Direct Similar Products Endpoint ---');
    const similarRes = await request('/api/products/prod-2/similar?limit=4');
    assert(similarRes.status === 200, 'GET /api/products/prod-2/similar returns 200');
    assert(Array.isArray(similarRes.data.products), 'Similar products is an array');
    assert(similarRes.data.products.length <= 4, 'Similar products respects limit');
    assert(
      !similarRes.data.products.some((p) => p.id === 'prod-2'),
      'Target product is excluded from its own similar products'
    );
    assert(
      similarRes.data.products.every(
        (p) => (p.category || '').toLowerCase() === 'men'
      ),
      'Similar products match target category (Men)'
    );

    // --- 11. Configurable Weights Endpoint ---
    console.log('\n--- 11. Configurable Ranking Weights Endpoint ---');
    const weightsRes = await request('/api/recommendations/weights');
    assert(weightsRes.status === 200, 'GET /api/recommendations/weights returns 200');
    assert(weightsRes.data.weights.wishlistSubcategory > 0, 'Wishlist weight is configurable');
    assert(weightsRes.data.weights.bestsellerBonus > 0, 'Bestseller bonus is configured');

    // --- 12. Robustness, Performance & Empty Catalogue Handling ---
    console.log('\n--- 12. Robustness, Performance & Edge Cases ---');
    // Performance check: measure latency
    const startPerf = Date.now();
    for (let i = 0; i < 5; i++) {
      await request('/api/recommendations?limit=10', 'GET', null, tokenA);
    }
    const elapsedMs = (Date.now() - startPerf) / 5;
    console.log(`Average recommendation API latency: ${elapsedMs.toFixed(1)}ms`);
    assert(elapsedMs < 100, 'Recommendation response latency is well under 100ms');

    // Invalid limit handling
    const invalidLimitRes = await request('/api/recommendations?limit=-5');
    assert(invalidLimitRes.status === 200, 'Negative limit falls back gracefully');
    assert(invalidLimitRes.data.products.length >= 1, 'Returns at least 1 product');

    // Super large limit handling
    const hugeLimitRes = await request('/api/recommendations?limit=9999');
    assert(hugeLimitRes.status === 200, 'Huge limit capped safely');
    assert(hugeLimitRes.data.products.length <= 50, 'Max limit capped at 50 products');

    console.log('\n============================================================');
    console.log('🎉 ALL TASK 6 RECOMMENDATION SYSTEM TESTS PASSED!');
    console.log('============================================================');
  } finally {
    if (server) {
      server.close();
    }
  }
}

server = app.listen(PORT, '127.0.0.1', () => {
  runTests().catch((err) => {
    console.error('Unhandled test execution error:', err);
    if (server) server.close();
    process.exit(1);
  });
});
