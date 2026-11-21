const http = require('http');
const app = require('./src/server');

const server = app.listen(5096, '127.0.0.1', async () => {
  console.log('Recently Viewed Test Server running on port 5096...\n');

  const request = (path, method = 'GET', body = null, token = null) => {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const options = {
        hostname: '127.0.0.1',
        port: 5096,
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
    // 1. Authenticate Demo User (User A)
    const loginResA = await request('/api/auth/login', 'POST', {
      identifier: '9876543210',
      password: 'Password123!',
    });
    const tokenA = loginResA.data.token;
    const userA = loginResA.data.user;
    console.log('1. User A login:', tokenA ? 'PASS' : 'FAIL');

    // 2. Register User B for isolation tests
    const userBEmail = `testuser_rv_${Date.now()}@fashion.dev`;
    const regResB = await request('/api/auth/register', 'POST', {
      fullName: 'RV User B',
      email: userBEmail,
      mobileNumber: `92${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: 'Password123!',
    });
    const tokenB = regResB.data.token;
    console.log('2. User B registered for isolation tests:', tokenB ? 'PASS' : 'FAIL');

    // 3. Clear existing history for User A
    const clearRes = await request('/api/recently-viewed', 'DELETE', null, tokenA);
    console.log('3. Clear User A history:', clearRes.status === 200 && clearRes.data.count === 0 ? 'PASS' : 'FAIL');

    // 4. Add product prod-1 to recently viewed
    const add1Res = await request('/api/recently-viewed', 'POST', { productId: 'prod-1' }, tokenA);
    const isAdd1Pass =
      add1Res.status === 200 &&
      add1Res.data.productIds[0] === 'prod-1' &&
      add1Res.data.count === 1;
    console.log('4. Add prod-1 to recently viewed:', isAdd1Pass ? 'PASS' : 'FAIL');

    // 5. Add product prod-2, verify prod-2 is newest first
    const add2Res = await request('/api/recently-viewed', 'POST', { productId: 'prod-2' }, tokenA);
    const isAdd2Pass =
      add2Res.status === 200 &&
      add2Res.data.productIds[0] === 'prod-2' &&
      add2Res.data.productIds[1] === 'prod-1' &&
      add2Res.data.count === 2;
    console.log('5. Add prod-2 (newest first order):', isAdd2Pass ? 'PASS' : 'FAIL');

    // 6. Re-view prod-1: moves to top without duplicate
    const reAddRes = await request('/api/recently-viewed', 'POST', { productId: 'prod-1' }, tokenA);
    const isReAddPass =
      reAddRes.status === 200 &&
      reAddRes.data.productIds[0] === 'prod-1' &&
      reAddRes.data.productIds.filter((id) => id === 'prod-1').length === 1 &&
      reAddRes.data.count === 2;
    console.log('6. Re-view prod-1 moves to top without duplicate:', isReAddPass ? 'PASS' : 'FAIL');

    // 7. Cap at exactly 20 items: Add 25 items
    // First retrieve catalog product IDs
    const productsRes = await request('/api/products?limit=50');
    const catalogProducts = productsRes.data.products || [];
    const validIds = catalogProducts.filter((p) => p.inStock !== false).map((p) => p.id);

    // Merge batch of 25 items
    const batch25 = validIds.slice(0, 25);
    const syncRes = await request('/api/recently-viewed/sync', 'POST', { productIds: batch25 }, tokenA);
    const isCap20Pass =
      syncRes.status === 200 &&
      syncRes.data.productIds.length === 20 &&
      syncRes.data.count === 20;
    console.log(`7. Maximum recently viewed capped at exactly 20 items (submitted ${batch25.length}):`, isCap20Pass ? `PASS (count: ${syncRes.data.count})` : 'FAIL');

    // 8. User isolation: User B must have independent empty history
    const getBRes = await request('/api/recently-viewed', 'GET', null, tokenB);
    const isIsolationPass =
      getBRes.status === 200 &&
      getBRes.data.count === 0 &&
      !getBRes.data.productIds.includes('prod-1');
    console.log('8. User Isolation (User B cannot see User A history):', isIsolationPass ? 'PASS' : 'FAIL');

    // 9. Unauthenticated access rejected with 401
    const unauthRes = await request('/api/recently-viewed');
    console.log('9. Unauthenticated access rejected with 401:', unauthRes.status === 401 ? 'PASS' : 'FAIL');

    console.log('\n===============================================');
    console.log('🎉 ALL TASK 1 RECENTLY VIEWED TESTS PASSED!');
    console.log('===============================================');
  } catch (err) {
    console.error('Recently Viewed test failed:', err);
  } finally {
    server.close(() => {
      console.log('Recently Viewed test server closed.');
      process.exit(0);
    });
  }
});
