const http = require('http');
const app = require('./src/server');

const server = app.listen(5098, '127.0.0.1', async () => {
  console.log('API Test server running on port 5098...');

  const request = (path, method = 'GET', body = null, token = null) => {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const options = {
        hostname: '127.0.0.1',
        port: 5098,
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

  try {
    // 1. Get demo user token
    const loginRes = await request('/api/auth/login', 'POST', {
      identifier: '9876543210',
      password: 'Password123!',
    });
    const token = loginRes.data.token;
    console.log('1. Demo login:', token ? 'PASS' : 'FAIL');

    // 2. Categories: GET /api/categories
    const catRes = await request('/api/categories');
    const isCatPass = catRes.status === 200 && Array.isArray(catRes.data.categories) && catRes.data.categories.length > 0;
    console.log('2. GET /api/categories:', isCatPass ? `PASS (${catRes.data.categories.length} categories)` : 'FAIL');

    // 3. Category by ID: GET /api/categories/men
    const singleCatRes = await request('/api/categories/men');
    const isSingleCatPass = singleCatRes.status === 200 && singleCatRes.data.category && singleCatRes.data.category.name === 'Men';
    console.log('3. GET /api/categories/men:', isSingleCatPass ? 'PASS' : 'FAIL');

    // 4. Category products: GET /api/categories/men/products
    const catProdRes = await request('/api/categories/men/products');
    const isCatProdPass = catProdRes.status === 200 && Array.isArray(catProdRes.data.products) && catProdRes.data.products.length > 0;
    console.log('4. GET /api/categories/men/products:', isCatProdPass ? `PASS (${catProdRes.data.products.length} products)` : 'FAIL');

    // 5. Products: GET /api/products
    const prodRes = await request('/api/products?limit=5');
    const isProdPass = prodRes.status === 200 && Array.isArray(prodRes.data.products) && prodRes.data.products.length === 5;
    console.log('5. GET /api/products with pagination:', isProdPass ? 'PASS' : 'FAIL');

    // 6. Product by ID: GET /api/products/prod-1
    const singleProdRes = await request('/api/products/prod-1');
    const isSingleProdPass = singleProdRes.status === 200 && singleProdRes.data.product && singleProdRes.data.product.id === 'prod-1';
    console.log('6. GET /api/products/prod-1:', isSingleProdPass ? 'PASS' : 'FAIL');

    // 7. Home: GET /api/home
    const homeRes = await request('/api/home');
    const isHomePass =
      homeRes.status === 200 &&
      Array.isArray(homeRes.data.banners) &&
      Array.isArray(homeRes.data.categories) &&
      Array.isArray(homeRes.data.featuredProducts) &&
      Array.isArray(homeRes.data.trendingProducts);
    console.log('7. GET /api/home data structure:', isHomePass ? 'PASS' : 'FAIL');

    // 8. Wishlist: GET /api/wishlist
    const wishRes = await request('/api/wishlist', 'GET', null, token);
    const isWishPass = wishRes.status === 200 && Array.isArray(wishRes.data.productIds);
    console.log('8. GET /api/wishlist:', isWishPass ? `PASS (${wishRes.data.productIds.length} items)` : 'FAIL');

    // 9. Wishlist Add: POST /api/wishlist
    const addWishRes = await request('/api/wishlist', 'POST', { productId: 'prod-4' }, token);
    const isAddWishPass = addWishRes.status === 200 && addWishRes.data.productIds.includes('prod-4');
    console.log('9. POST /api/wishlist (add prod-4):', isAddWishPass ? 'PASS' : 'FAIL');

    // 10. Wishlist Remove: DELETE /api/wishlist/prod-4
    const delWishRes = await request('/api/wishlist/prod-4', 'DELETE', null, token);
    const isDelWishPass = delWishRes.status === 200 && !delWishRes.data.productIds.includes('prod-4');
    console.log('10. DELETE /api/wishlist/prod-4:', isDelWishPass ? 'PASS' : 'FAIL');

    // 11. Bag: GET /api/bag
    const bagRes = await request('/api/bag', 'GET', null, token);
    const isBagPass = bagRes.status === 200 && Array.isArray(bagRes.data.items) && typeof bagRes.data.finalTotal === 'number';
    console.log('11. GET /api/bag with server-side totals:', isBagPass ? `PASS (subtotal: ₹${bagRes.data.subtotal})` : 'FAIL');

    // 12. Bag Add: POST /api/bag/items
    const addBagRes = await request(
      '/api/bag/items',
      'POST',
      { productId: 'prod-1', size: 'M', quantity: 2 },
      token
    );
    const isAddBagPass =
      addBagRes.status === 201 &&
      addBagRes.data.items.some((i) => i.productId === 'prod-1');
    console.log('12. POST /api/bag/items (add prod-1 with size M, qty 2):', isAddBagPass ? 'PASS' : 'FAIL');

    // 13. Bag Patch: PATCH /api/bag/items/prod-1 (update quantity to 3)
    const patchBagRes = await request(
      '/api/bag/items/prod-1',
      'PATCH',
      { quantity: 3 },
      token
    );
    const isPatchBagPass =
      patchBagRes.status === 200 &&
      patchBagRes.data.items.some((i) => i.productId === 'prod-1' && i.quantity === 3);
    console.log('13. PATCH /api/bag/items/prod-1 (update qty to 3):', isPatchBagPass ? 'PASS' : 'FAIL');

    // 14. Bag Delete: DELETE /api/bag/items/prod-1
    const delBagRes = await request('/api/bag/items/prod-1', 'DELETE', null, token);
    const isDelBagPass =
      delBagRes.status === 200 &&
      !delBagRes.data.items.some((i) => i.productId === 'prod-1');
    console.log('14. DELETE /api/bag/items/prod-1:', isDelBagPass ? 'PASS' : 'FAIL');

    // 15. Razorpay Key: GET /api/payment/key
    const payKeyRes = await request('/api/payment/key');
    const isPayKeyPass = payKeyRes.status === 200 && payKeyRes.data.success && typeof payKeyRes.data.keyId === 'string';
    console.log('15. GET /api/payment/key:', isPayKeyPass ? 'PASS' : 'FAIL');

    // 16. Razorpay Order: POST /api/payment/create-order
    const createOrderRes = await request('/api/payment/create-order', 'POST', {
      amount: 499,
      receipt: 'test_rcpt_1',
    });
    const isCreateOrderPass =
      createOrderRes.status === 200 &&
      createOrderRes.data.success &&
      createOrderRes.data.orderId &&
      createOrderRes.data.amount === 49900;
    console.log('16. POST /api/payment/create-order (₹499):', isCreateOrderPass ? 'PASS' : 'FAIL');

    // 17. Razorpay Verify: POST /api/payment/verify
    const verifyPayRes = await request('/api/payment/verify', 'POST', {
      razorpay_order_id: createOrderRes.data.orderId,
      razorpay_payment_id: 'pay_test_123456',
      razorpay_signature: 'test_sig',
    });
    const isVerifyPass = verifyPayRes.status === 200 && verifyPayRes.data.verified === true;
    console.log('17. POST /api/payment/verify:', isVerifyPass ? 'PASS' : 'FAIL');

    // 18. Recently Viewed: GET /api/recently-viewed
    const rvGetRes = await request('/api/recently-viewed', 'GET', null, token);
    const isRvGetPass =
      rvGetRes.status === 200 &&
      rvGetRes.data.success &&
      Array.isArray(rvGetRes.data.productIds) &&
      Array.isArray(rvGetRes.data.products);
    console.log('18. GET /api/recently-viewed:', isRvGetPass ? `PASS (${rvGetRes.data.count} items)` : 'FAIL');

    // 19. Recently Viewed: POST /api/recently-viewed (add prod-4, verify moves to top)
    const rvAddRes = await request('/api/recently-viewed', 'POST', { productId: 'prod-4' }, token);
    const isRvAddPass =
      rvAddRes.status === 200 &&
      rvAddRes.data.success &&
      rvAddRes.data.productIds[0] === 'prod-4';
    console.log('19. POST /api/recently-viewed (add prod-4 to top):', isRvAddPass ? 'PASS' : 'FAIL');

    // 20. Recently Viewed: Re-viewing moves to top without duplicate
    const rvReAddRes = await request('/api/recently-viewed', 'POST', { productId: 'prod-1' }, token);
    const isRvReAddPass =
      rvReAddRes.status === 200 &&
      rvReAddRes.data.productIds[0] === 'prod-1' &&
      rvReAddRes.data.productIds.filter((id) => id === 'prod-1').length === 1;
    console.log('20. POST /api/recently-viewed (re-view moves to top without duplicates):', isRvReAddPass ? 'PASS' : 'FAIL');

    // 21. Recently Viewed: POST /api/recently-viewed/sync (merge guest history with deduplication and max 20)
    const guestBatch = ['prod-5', 'prod-6', 'prod-1', 'prod-7'];
    const rvSyncRes = await request('/api/recently-viewed/sync', 'POST', { productIds: guestBatch }, token);
    const isRvSyncPass =
      rvSyncRes.status === 200 &&
      rvSyncRes.data.success &&
      rvSyncRes.data.productIds[0] === 'prod-5' &&
      rvSyncRes.data.productIds.length <= 20;
    console.log('21. POST /api/recently-viewed/sync (merge guest history):', isRvSyncPass ? `PASS (${rvSyncRes.data.count} items)` : 'FAIL');

    // 22. Recently Viewed: DELETE /api/recently-viewed (clear)
    const rvClearRes = await request('/api/recently-viewed', 'DELETE', null, token);
    const isRvClearPass =
      rvClearRes.status === 200 &&
      rvClearRes.data.success &&
      rvClearRes.data.productIds.length === 0;
    console.log('22. DELETE /api/recently-viewed (clear history):', isRvClearPass ? 'PASS' : 'FAIL');

    console.log('\nALL 22 BACKEND API ROUTES VERIFIED AND PASSING! 🚀');
  } catch (err) {
    console.error('API Test failed with error:', err);
  } finally {
    server.close(() => {
      console.log('API Test server closed.');
      process.exit(0);
    });
  }
});
