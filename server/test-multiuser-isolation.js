const http = require('http');
const app = require('./src/server');

const TEST_PORT = 5096;

const server = app.listen(TEST_PORT, '127.0.0.1', async () => {
  console.log('================================================================');
  console.log('  RUNNING COMPREHENSIVE MULTI-USER & SECURITY ISOLATION SUITE');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log('  [PASS]', message);
      passed++;
    } else {
      console.error('  [FAIL]', message);
      failed++;
    }
  };

  const request = (path, method = 'GET', body = null, token = null) => {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const options = {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
      };

      const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: responseBody ? JSON.parse(responseBody) : {},
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              raw: responseBody,
              data: null,
            });
          }
        });
      });

      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  };

  try {
    const timestamp = Date.now();
    const userA_email = 'usera_' + timestamp + '@fashion.dev';
    const userB_email = 'userb_' + timestamp + '@fashion.dev';
    const userC_email = 'userc_' + timestamp + '@fashion.dev';
    const mobileA = '9' + Math.floor(100000000 + Math.random() * 900000000);
    const mobileB = '9' + Math.floor(100000000 + Math.random() * 900000000);
    const mobileC = '9' + Math.floor(100000000 + Math.random() * 900000000);
    const password = 'Password123!';

    let userA_token = null;
    let userA_id = null;
    let userB_token = null;
    let userB_id = null;
    let orderA_id = null;
    let addressA_id = null;

    // -------------------------------------------------------------
    // TEST A: User A Registration & Authentication
    // -------------------------------------------------------------
    console.log('\n[TEST A] User A Registration & Authentication');
    const regARes = await request('/api/auth/register', 'POST', {
      fullName: 'User Alpha',
      email: userA_email,
      mobileNumber: mobileA,
      password: password,
      confirmPassword: password,
      gender: 'Men',
      termsAccepted: true,
    });
    assert(regARes.status === 201, 'User A registered successfully with HTTP 201');
    assert(regARes.data.token && regARes.data.user, 'User A returned valid JWT and user object');
    userA_token = regARes.data.token;
    userA_id = regARes.data.user.id;

    const loginARes = await request('/api/auth/login', 'POST', {
      identifier: userA_email,
      password: password,
    });
    assert(loginARes.status === 200, 'User A login succeeded with HTTP 200');
    assert(loginARes.data.user.id === userA_id, 'User A credentials returned matching account ID');

    // -------------------------------------------------------------
    // TEST B: User A Private Data Creation (Cart, Wishlist, Address, Orders)
    // -------------------------------------------------------------
    console.log('\n[TEST B] User A Private Data Creation');
    
    // 1. Bag
    const addCartRes = await request('/api/bag/items', 'POST', {
      productId: 'prod-1',
      quantity: 2,
      size: 'M',
    }, userA_token);
    assert([200, 201].includes(addCartRes.status), 'User A added prod-1 to bag');

    const addCartRes2 = await request('/api/bag/items', 'POST', {
      productId: 'prod-3',
      quantity: 1,
      size: 'L',
    }, userA_token);
    assert([200, 201].includes(addCartRes2.status), 'User A added prod-3 to bag');

    const getCartA = await request('/api/bag', 'GET', null, userA_token);
    assert(getCartA.status === 200 && getCartA.data.items && getCartA.data.items.length >= 2, 'User A bag contains 2 items');

    // 2. Wishlist
    const wishRes = await request('/api/wishlist', 'POST', {
      productId: 'prod-2',
    }, userA_token);
    assert(wishRes.status === 200, 'User A added prod-2 to wishlist');

    const getWishA = await request('/api/wishlist', 'GET', null, userA_token);
    assert(getWishA.status === 200 && getWishA.data.productIds && getWishA.data.productIds.includes('prod-2'), 'User A wishlist contains prod-2');

    // 3. Address
    const addAddressRes = await request('/api/addresses', 'POST', {
      name: 'User Alpha',
      mobile: mobileA,
      pincode: '400001',
      address: 'Penthouse 42, Marine Drive',
      city: 'Mumbai',
      state: 'Maharashtra',
      addressType: 'Home',
    }, userA_token);
    assert(addAddressRes.status === 201, 'User A created delivery address');
    addressA_id = addAddressRes.data.address ? addAddressRes.data.address.id : addAddressRes.data.id;

    // 4. Order
    const placeOrderRes = await request('/api/orders', 'POST', {
      items: [
        {
          productId: 'prod-1',
          name: 'Classic Oxford Shirt',
          brand: 'Roadster',
          price: 999,
          originalPrice: 1999,
          quantity: 2,
          size: 'M',
          color: 'Blue',
          imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c',
        },
      ],
      shippingAddress: {
        id: addressA_id,
        name: 'User Alpha',
        mobile: mobileA,
        pincode: '400001',
        address: 'Penthouse 42, Marine Drive',
        city: 'Mumbai',
        state: 'Maharashtra',
        addressType: 'Home',
      },
      paymentMethod: 'UPI',
    }, userA_token);
    assert(placeOrderRes.status === 201, 'User A successfully placed order with HTTP 201');
    orderA_id = placeOrderRes.data.order ? placeOrderRes.data.order.id : placeOrderRes.data.id;
    assert(orderA_id != null, 'Order ID created: ' + orderA_id);

    // -------------------------------------------------------------
    // TEST C: User A Logout & Push Token Deactivation
    // -------------------------------------------------------------
    console.log('\n[TEST C] User A Logout & Push Token Deactivation');
    const pushToken = 'ExponentPushToken[userA_test_token_' + timestamp + ']';
    const regPushRes = await request('/api/notifications/register-device', 'POST', {
      pushToken: pushToken,
      platform: 'web',
      deviceModel: 'Chrome Windows',
    }, userA_token);
    assert(regPushRes.status === 200, 'User A registered push device token');

    const logoutRes = await request('/api/auth/logout', 'POST', {
      devicePushToken: pushToken,
    }, userA_token);
    assert(logoutRes.status === 200, 'User A logged out successfully');

    // -------------------------------------------------------------
    // TEST D: Guest User Browsing & Total Isolation from User A
    // -------------------------------------------------------------
    console.log('\n[TEST D] Guest Browsing Isolation (Zero Leaked Data)');
    const guestCart = await request('/api/bag', 'GET', null, null);
    assert(guestCart.status === 401, 'Guest cart returns 401 Unauthorized (private cart protected)');

    const guestWish = await request('/api/wishlist', 'GET', null, null);
    assert(guestWish.status === 401, 'Guest wishlist returns 401 Unauthorized');

    const guestOrders = await request('/api/orders', 'GET', null, null);
    assert(guestOrders.status === 401, 'Guest orders returns 401 Unauthorized');

    const guestAddresses = await request('/api/addresses', 'GET', null, null);
    assert(guestAddresses.status === 401, 'Guest addresses returns 401 Unauthorized');

    const publicCatalog = await request('/api/products', 'GET', null, null);
    assert(publicCatalog.status === 200 && Array.isArray(publicCatalog.data.products), 'Guest can freely browse public product catalog');

    // -------------------------------------------------------------
    // TEST E: User B Registration & Clean Isolated Space
    // -------------------------------------------------------------
    console.log('\n[TEST E] User B Registration & Data Isolation');
    const regBRes = await request('/api/auth/register', 'POST', {
      fullName: 'User Beta',
      email: userB_email,
      mobileNumber: mobileB,
      password: password,
      confirmPassword: password,
      gender: 'Women',
      termsAccepted: true,
    });
    assert(regBRes.status === 201, 'User B registered successfully');
    userB_token = regBRes.data.token;
    userB_id = regBRes.data.user.id;
    assert(userB_id !== userA_id, 'User B has completely distinct userId from User A');

    const getCartB = await request('/api/bag', 'GET', null, userB_token);
    assert(getCartB.status === 200 && (!getCartB.data.items || getCartB.data.items.length === 0), 'User B cart is completely empty (0 items leaked from User A)');

    const getWishB = await request('/api/wishlist', 'GET', null, userB_token);
    assert(getWishB.status === 200 && (!getWishB.data.productIds || getWishB.data.productIds.length === 0), 'User B wishlist is empty (0 products leaked from User A)');

    const getOrdersB = await request('/api/orders', 'GET', null, userB_token);
    const userBOrders = getOrdersB.data.orders || [];
    assert(getOrdersB.status === 200 && Array.isArray(userBOrders) && userBOrders.length === 0, 'User B orders list is empty (0 orders leaked from User A)');

    const getAddressB = await request('/api/addresses', 'GET', null, userB_token);
    const userBAddresses = getAddressB.data.addresses || [];
    assert(getAddressB.status === 200 && Array.isArray(userBAddresses) && userBAddresses.length === 0, 'User B addresses list is empty (0 addresses leaked from User A)');

    // -------------------------------------------------------------
    // TEST F: User A Re-login & Data Preservation
    // -------------------------------------------------------------
    console.log('\n[TEST F] User A Re-login & Data Preservation');
    const reloginARes = await request('/api/auth/login', 'POST', {
      identifier: userA_email,
      password: password,
    });
    assert(reloginARes.status === 200, 'User A logged back in');
    const freshTokenA = reloginARes.data.token;

    const restoreOrdersA = await request('/api/orders', 'GET', null, freshTokenA);
    const userAOrders = restoreOrdersA.data.orders || [];
    assert(restoreOrdersA.status === 200 && userAOrders.some((o) => o.id === orderA_id), 'User A previous order ' + orderA_id + ' intact and restored');

    const restoreWishA = await request('/api/wishlist', 'GET', null, freshTokenA);
    assert(restoreWishA.status === 200 && restoreWishA.data.productIds.includes('prod-2'), 'User A wishlist prod-2 intact and restored');

    const restoreAddressA = await request('/api/addresses', 'GET', null, freshTokenA);
    const userAAddresses = restoreAddressA.data.addresses || [];
    assert(restoreAddressA.status === 200 && userAAddresses.some((a) => a.id === addressA_id), 'User A address ' + addressA_id + ' intact and restored');

    // -------------------------------------------------------------
    // TEST G: Refresh & Session Persistence
    // -------------------------------------------------------------
    console.log('\n[TEST G] Refresh & Session Persistence');
    const meRes = await request('/api/auth/me', 'GET', null, freshTokenA);
    assert(meRes.status === 200 && meRes.data.user.id === userA_id, 'GET /api/auth/me with valid token restored User A session');

    const invalidMeRes = await request('/api/auth/me', 'GET', null, 'invalid_corrupted_token_xyz');
    assert(invalidMeRes.status === 401, 'GET /api/auth/me with invalid token rejected with HTTP 401');

    const emptyMeRes = await request('/api/auth/me', 'GET', null, null);
    assert(emptyMeRes.status === 401, 'GET /api/auth/me with missing token rejected with HTTP 401');

    // -------------------------------------------------------------
    // TEST H: Concurrent Multi-Device Sessions
    // -------------------------------------------------------------
    console.log('\n[TEST H] Concurrent Multi-Device Sessions');
    const [concurrentA, concurrentB] = await Promise.all([
      request('/api/bag/items', 'POST', { productId: 'prod-4', quantity: 1, size: 'Regular' }, freshTokenA),
      request('/api/bag/items', 'POST', { productId: 'prod-5', quantity: 3, size: 'M' }, userB_token),
    ]);
    assert([200, 201].includes(concurrentA.status), 'Concurrent session A wrote to User A bag successfully');
    assert([200, 201].includes(concurrentB.status), 'Concurrent session B wrote to User B bag successfully');

    const [finalCartA, finalCartB] = await Promise.all([
      request('/api/bag', 'GET', null, freshTokenA),
      request('/api/bag', 'GET', null, userB_token),
    ]);
    assert(finalCartA.data.items.some((i) => i.productId === 'prod-4'), 'User A bag contains prod-4');
    assert(!finalCartA.data.items.some((i) => i.productId === 'prod-5'), 'User A bag does NOT contain User B prod-5');
    assert(finalCartB.data.items.some((i) => i.productId === 'prod-5'), 'User B bag contains prod-5');
    assert(!finalCartB.data.items.some((i) => i.productId === 'prod-4'), 'User B bag does NOT contain User A prod-4');

    // -------------------------------------------------------------
    // TEST I: IDOR Security Penetration Attacks (Cross-User Access)
    // -------------------------------------------------------------
    console.log('\n[TEST I] IDOR Attack Prevention & Access Control');

    // 1. User B tries to view User A's order by ID
    const idorOrderRes = await request('/api/orders/' + orderA_id, 'GET', null, userB_token);
    assert(idorOrderRes.status === 403, 'User B accessing User A order returned 403 Forbidden [IDOR Defeated]');

    // 2. User B tries to download User A's order invoice
    const idorInvoiceRes = await request('/api/orders/' + orderA_id + '/invoice', 'GET', null, userB_token);
    assert(idorInvoiceRes.status === 403, 'User B downloading User A invoice returned 403 Forbidden [IDOR Defeated]');

    // 3. User B tries to cancel User A's order
    const idorCancelRes = await request('/api/orders/' + orderA_id + '/cancel', 'POST', { reason: 'malicious' }, userB_token);
    assert(idorCancelRes.status === 403, 'User B cancelling User A order returned 403 Forbidden [IDOR Defeated]');

    // 4. User B tries to update User A's order status
    const idorStatusRes = await request('/api/orders/' + orderA_id + '/status', 'PATCH', { status: 'Delivered' }, userB_token);
    assert(idorStatusRes.status === 403, 'User B changing User A order status returned 403 Forbidden [IDOR Defeated]');

    // 5. User B tries to edit User A's address
    const idorAddressUpdate = await request('/api/addresses/' + addressA_id, 'PUT', { name: 'Hacker' }, userB_token);
    assert([403, 404].includes(idorAddressUpdate.status), 'User B editing User A address returned ' + idorAddressUpdate.status + ' [IDOR Defeated]');

    // 6. User B tries to delete User A's address
    const idorAddressDelete = await request('/api/addresses/' + addressA_id, 'DELETE', null, userB_token);
    assert([403, 404].includes(idorAddressDelete.status), 'User B deleting User A address returned ' + idorAddressDelete.status + ' [IDOR Defeated]');

    // 7. User B tries to verify payment for User A's order
    const idorPaymentVerify = await request('/api/payment/verify', 'POST', {
      razorpay_order_id: orderA_id,
      razorpay_payment_id: 'pay_fake_' + timestamp,
      internalOrderId: orderA_id,
      razorpay_signature: 'sig_fake',
    }, userB_token);
    assert(idorPaymentVerify.status === 403, 'User B verifying payment for User A order returned 403 Forbidden [IDOR Defeated]');

    // 8. Unauthenticated request to order by ID
    const unauthOrder = await request('/api/orders/' + orderA_id, 'GET', null, null);
    assert(unauthOrder.status === 401, 'Unauthenticated access to order returned 401 Unauthorized');

    // -------------------------------------------------------------
    // TEST J: Guest Cart Merging Upon Registration / Login
    // -------------------------------------------------------------
    console.log('\n[TEST J] Guest-to-User Cart Merging');
    const regCRes = await request('/api/auth/register', 'POST', {
      fullName: 'User Charlie',
      email: userC_email,
      mobileNumber: mobileC,
      password: password,
      confirmPassword: password,
      gender: 'Men',
      termsAccepted: true,
    });
    assert(regCRes.status === 201, 'User C registered successfully');
    const userC_token = regCRes.data.token;

    // Merge guest items into User C's account
    const mergeRes = await request('/api/bag/merge', 'POST', {
      cartItems: [
        {
          productId: 'prod-6',
          quantity: 2,
          size: 'One Size (44mm)',
        },
      ],
    }, userC_token);
    assert(mergeRes.status === 200, 'Guest items successfully merged via /api/bag/merge');

    const cartC = await request('/api/bag', 'GET', null, userC_token);
    assert(cartC.data.items && cartC.data.items.some((i) => i.productId === 'prod-6'), 'User C cart reflects merged items');

    // -------------------------------------------------------------
    // REAL-TIME SSE TEST: Verify /api/realtime/stream
    // -------------------------------------------------------------
    console.log('\n[REAL-TIME SSE] Testing Server-Sent Events Endpoint');
    const sseConnected = await new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/realtime/stream',
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          Authorization: 'Bearer ' + freshTokenA,
        },
      }, (res) => {
        let connected = res.statusCode === 200 && (res.headers['content-type'] || '').includes('text/event-stream');
        res.on('data', (chunk) => {
          const str = chunk.toString();
          if (str.includes('connected')) {
            req.destroy();
            resolve(true);
          }
        });
        setTimeout(() => {
          req.destroy();
          resolve(connected);
        }, 1200);
      });
      req.on('error', () => resolve(false));
      req.end();
    });
    assert(sseConnected, 'SSE stream /api/realtime/stream successfully connected and established handshake');

  } catch (err) {
    console.error('Unexpected test error:', err);
    failed++;
  } finally {
    server.close(() => {
      console.log('\n================================================================');
      console.log('  TEST RESULTS: ' + passed + ' PASSED | ' + failed + ' FAILED');
      console.log('================================================================\n');
      process.exit(failed > 0 ? 1 : 0);
    });
  }
});
