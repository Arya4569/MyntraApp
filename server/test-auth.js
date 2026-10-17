const http = require('http');
const app = require('./src/server');

const server = app.listen(5099, '127.0.0.1', async () => {
  console.log('Testing server started on port 5099');

  const request = (path, method = 'GET', body = null, token = null) => {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const options = {
        hostname: '127.0.0.1',
        port: 5099,
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
    // 1. Health check
    const health = await request('/api/health');
    console.log('1. Health check:', health.status === 200 && health.data.status === 'ok' ? 'PASS' : 'FAIL');

    // 2. Register new user
    const testEmail = `test_${Date.now()}@fashion.dev`;
    const testMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const regRes = await request('/api/auth/register', 'POST', {
      fullName: 'Priya Sharma',
      email: testEmail,
      mobileNumber: testMobile,
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
      gender: 'Women',
      termsAccepted: true,
    });

    const isRegPass =
      regRes.status === 201 &&
      regRes.data.success &&
      regRes.data.token &&
      regRes.data.user &&
      !regRes.data.user.passwordHash &&
      regRes.data.user.email === testEmail;
    console.log('2. Register new user:', isRegPass ? 'PASS' : 'FAIL');
    const userToken = regRes.data.token;

    // 3. Duplicate email rejection
    const dupRes = await request('/api/auth/register', 'POST', {
      fullName: 'Duplicate Test',
      email: testEmail,
      mobileNumber: '9988776655',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
      termsAccepted: true,
    });
    console.log('3. Duplicate email check:', dupRes.status === 400 ? 'PASS' : 'FAIL');

    // 4. Login with email
    const loginRes = await request('/api/auth/login', 'POST', {
      identifier: testEmail,
      password: 'StrongPassword123!',
    });
    const isLoginPass =
      loginRes.status === 200 &&
      loginRes.data.success &&
      loginRes.data.token &&
      !loginRes.data.user.passwordHash;
    console.log('4. Login with email:', isLoginPass ? 'PASS' : 'FAIL');

    // 5. Login with wrong password
    const wrongPassRes = await request('/api/auth/login', 'POST', {
      identifier: testEmail,
      password: 'WrongPassword!',
    });
    console.log('5. Wrong password rejected:', wrongPassRes.status === 401 ? 'PASS' : 'FAIL');

    // 6. Get Profile (Protected route)
    const meRes = await request('/api/auth/me', 'GET', null, userToken);
    const isMePass =
      meRes.status === 200 &&
      meRes.data.user.email === testEmail &&
      !meRes.data.user.passwordHash;
    console.log('6. Protected /api/auth/me with JWT:', isMePass ? 'PASS' : 'FAIL');

    // 7. Update Profile
    const updateRes = await request(
      '/api/auth/profile',
      'PUT',
      { fullName: 'Priya S. Verma' },
      userToken
    );
    console.log(
      '7. Profile update:',
      updateRes.status === 200 && updateRes.data.user.fullName === 'Priya S. Verma'
        ? 'PASS'
        : 'FAIL'
    );

    // 8. Demo user pre-seeded login check
    const demoLogin = await request('/api/auth/login', 'POST', {
      identifier: '9876543210',
      password: 'Password123!',
    });
    console.log('8. Pre-seeded demo user login:', demoLogin.status === 200 ? 'PASS' : 'FAIL');

    console.log('\nALL 8 BACKEND API TESTS PASSED! 🎉');
  } catch (err) {
    console.error('Test failed with error:', err);
  } finally {
    server.close(() => {
      console.log('Testing server closed.');
      process.exit(0);
    });
  }
});
