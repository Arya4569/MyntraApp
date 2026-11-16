const http = require('http');
const app = require('./src/server');

const PORT = 5096;
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
  console.log('🧪 RUNNING SAVED ADDRESS & NOTIFICATION ISOLATION TESTS');
  console.log('============================================================\n');

  // --- Step 1: Unauthenticated Guest Notification Isolation ---
  console.log('--- 1. Guest Notification Isolation ---');
  const guestNotifsRes = await request('/api/notifications');
  assert(guestNotifsRes.status === 200, 'Guest GET /api/notifications returns 200');
  assert(
    Array.isArray(guestNotifsRes.data.notifications) && guestNotifsRes.data.notifications.length === 0,
    'Guest GET /api/notifications returns empty array (zero private notifications leaked)'
  );
  assert(guestNotifsRes.data.unreadCount === 0, 'Guest unreadCount is 0');

  const guestUnreadRes = await request('/api/notifications/unread-count');
  assert(guestUnreadRes.status === 200, 'Guest GET /api/notifications/unread-count returns 200');
  assert(guestUnreadRes.data.unreadCount === 0, 'Guest unread count is exactly 0 (no usr-demo-1 badge)');

  const guestRegisterDevice = await request('/api/notifications/register-device', 'POST', {
    pushToken: 'ExponentPushToken[guest_attempt]',
  });
  assert(guestRegisterDevice.status === 401, 'Unauthenticated push token registration rejected with 401');

  // --- Step 2: Unauthenticated Guest Address Access ---
  console.log('\n--- 2. Guest Address Protection ---');
  const guestAddressRes = await request('/api/addresses');
  assert(guestAddressRes.status === 401, 'Unauthenticated GET /api/addresses rejected with 401 Unauthorized');

  // --- Step 3: User A Login & Address Management ---
  console.log('\n--- 3. User A Authentication & Address Ownership ---');
  const loginResA = await request('/api/auth/login', 'POST', {
    identifier: '9876543210',
    password: 'Password123!',
  });
  assert(loginResA.status === 200 && loginResA.data.token, 'User A (Demo user) login succeeds');
  const tokenA = loginResA.data.token;
  const userA = loginResA.data.user;

  const userAAddressesRes = await request('/api/addresses', 'GET', null, tokenA);
  assert(userAAddressesRes.status === 200, 'User A GET /api/addresses returns 200');
  assert(Array.isArray(userAAddressesRes.data.addresses), 'User A addresses is an array');
  assert(userAAddressesRes.data.addresses.length >= 1, 'User A has at least 1 saved address');
  assert(userAAddressesRes.data.addresses[0].name === 'Aryak Sharma', "User A address belongs to Aryak Sharma");
  const userAAddressId = userAAddressesRes.data.addresses[0].id;

  // User A Notifications
  const userANotifsRes = await request('/api/notifications', 'GET', null, tokenA);
  assert(userANotifsRes.status === 200, 'User A GET /api/notifications succeeds');
  assert(userANotifsRes.data.notifications.length > 0, 'User A has notifications');
  const userANotifId = userANotifsRes.data.notifications[0].id;

  // --- Step 4: Register User B (Fresh Account With 0 Addresses) ---
  console.log('\n--- 4. User B Account Creation & Empty State Isolation ---');
  const userBEmail = `isolated_b_${Date.now()}@fashion.dev`;
  const userBMobile = `93${Math.floor(10000000 + Math.random() * 90000000)}`;
  const regResB = await request('/api/auth/register', 'POST', {
    fullName: 'Priya Verma',
    email: userBEmail,
    mobileNumber: userBMobile,
    password: 'Password123!',
    gender: 'Women',
  });
  assert(regResB.status === 201 && regResB.data.token, 'User B registered successfully');
  const tokenB = regResB.data.token;
  const userB = regResB.data.user;

  // User B Address Empty State
  const userBAddressesRes = await request('/api/addresses', 'GET', null, tokenB);
  assert(userBAddressesRes.status === 200, 'User B GET /api/addresses returns 200');
  assert(Array.isArray(userBAddressesRes.data.addresses) && userBAddressesRes.data.addresses.length === 0,
    'User B has exactly 0 addresses (empty state - User A address NOT leaked!)'
  );

  // User B Notifications Isolation (User A notifications NOT leaked to User B)
  const userBNotifsRes = await request('/api/notifications', 'GET', null, tokenB);
  assert(userBNotifsRes.status === 200, 'User B GET /api/notifications returns 200');
  assert(
    !userBNotifsRes.data.notifications.some((n) => n.userId === userA.id),
    'User B has no notifications from User A (User A notifications NOT leaked!)'
  );

  const userBUnreadRes = await request('/api/notifications/unread-count', 'GET', null, tokenB);
  assert(
    userBUnreadRes.data.unreadCount <= 1,
    'User B has only their own welcome notification (User A notifications NOT leaked!)'
  );

  // --- Step 5: Unauthorized Cross-User Access Attacks ---
  console.log('\n--- 5. Cross-User Security Enforcement ---');
  // User B attempts to update User A's address
  const hackUpdateAddress = await request(
    `/api/addresses/${userAAddressId}`,
    'PUT',
    { name: 'Hacked Name', address: 'Malicious Address' },
    tokenB
  );
  assert(hackUpdateAddress.status === 403, 'User B rejected with 403 Forbidden when trying to update User A address');

  // User B attempts to delete User A's address
  const hackDeleteAddress = await request(
    `/api/addresses/${userAAddressId}`,
    'DELETE',
    null,
    tokenB
  );
  assert(hackDeleteAddress.status === 403, 'User B rejected with 403 Forbidden when trying to delete User A address');

  // User B attempts to mark User A's notification as read
  const hackReadNotif = await request(
    `/api/notifications/${userANotifId}/read`,
    'PATCH',
    null,
    tokenB
  );
  assert(hackReadNotif.status === 403, 'User B rejected with 403 Forbidden when trying to mark User A notification read');

  // User B attempts to delete User A's notification
  const hackDeleteNotif = await request(
    `/api/notifications/${userANotifId}`,
    'DELETE',
    null,
    tokenB
  );
  assert(hackDeleteNotif.status === 403, 'User B rejected with 403 Forbidden when trying to delete User A notification');

  // --- Step 6: User B Creates Their Own Address ---
  console.log('\n--- 6. User B Address Creation & Scoping ---');
  const createBAddrRes = await request(
    '/api/addresses',
    'POST',
    {
      name: 'Priya Verma',
      mobile: '9312345678',
      pincode: '560001',
      address: 'No. 24, Prestige Towers, MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      addressType: 'Home',
    },
    tokenB
  );
  assert(createBAddrRes.status === 201, 'User B created delivery address successfully (201)');
  assert(createBAddrRes.data.address.name === 'Priya Verma', 'Created address belongs to Priya Verma');
  assert(createBAddrRes.data.address.isDefault === true, 'First address automatically set as default');
  const userBAddressId = createBAddrRes.data.address.id;

  // Verify User B addresses contains only User B's address
  const bListAfterCreate = await request('/api/addresses', 'GET', null, tokenB);
  assert(bListAfterCreate.data.addresses.length === 1, 'User B has exactly 1 address');
  assert(bListAfterCreate.data.addresses[0].id === userBAddressId, 'User B address list matches created address');

  // Verify User A address list is completely unaffected
  const aListCheck = await request('/api/addresses', 'GET', null, tokenA);
  assert(!aListCheck.data.addresses.some((a) => a.id === userBAddressId), 'User A does not see User B address');

  // --- Step 7: Push Token Association, Transfer & Logout ---
  console.log('\n--- 7. Push Token Association, Transfer & Logout ---');
  const testSharedDeviceToken = 'ExponentPushToken[shared_hardware_device_123]';

  // User A registers the device token
  const regDevA = await request('/api/notifications/register-device', 'POST', {
    pushToken: testSharedDeviceToken,
    platform: 'android',
  }, tokenA);
  assert(regDevA.status === 200, 'User A registered shared device push token');

  // User A logs out
  const logoutA = await request('/api/auth/logout', 'POST', {
    pushToken: testSharedDeviceToken,
  }, tokenA);
  assert(logoutA.status === 200, 'User A logged out; push token deactivated');

  // User B logs in on same device and registers the token
  const regDevB = await request('/api/notifications/register-device', 'POST', {
    pushToken: testSharedDeviceToken,
    platform: 'android',
  }, tokenB);
  assert(regDevB.status === 200, 'User B registered shared device push token');
  assert(regDevB.data.device.userId === userB.id, 'Device push token successfully transferred to User B');

  // Verify User A no longer owns that active token
  const DeviceToken = require('./src/models/DeviceToken');
  const tokensA = DeviceToken.findByUserId(userA.id);
  assert(!tokensA.some((t) => t.token === testSharedDeviceToken), 'User A no longer has active push token on this device');

  // --- Step 8: Database Integrity & Preservation ---
  console.log('\n--- 8. Database Integrity & Data Preservation ---');
  const db = require('./src/db');
  const finalDb = db.read();
  assert(finalDb.users.some((u) => u.id === 'usr-demo-1'), 'Original demo user preserved in database');
  assert(finalDb.addresses['usr-demo-1'] && finalDb.addresses['usr-demo-1'].length >= 1, 'User A addresses preserved in database');
  assert(finalDb.addresses[userB.id] && finalDb.addresses[userB.id].length === 1, 'User B addresses persisted in database');

    console.log('\n============================================================');
    console.log('🎉 ALL SAVED ADDRESS & NOTIFICATION ISOLATION TESTS PASSED!');
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
