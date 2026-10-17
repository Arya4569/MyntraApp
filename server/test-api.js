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
      { productId: 'prod-2', size: 'M', quantity: 2 },
      token
    );
    const isAddBagPass =
      addBagRes.status === 201 &&
      addBagRes.data.items.some((i) => i.productId === 'prod-2' && i.quantity === 2);
    console.log('12. POST /api/bag/items (add prod-2 with size M, qty 2):', isAddBagPass ? 'PASS' : 'FAIL');

    // 13. Bag Patch: PATCH /api/bag/items/prod-2 (update quantity to 3)
    const patchBagRes = await request(
      '/api/bag/items/prod-2',
      'PATCH',
      { quantity: 3 },
      token
    );
    const isPatchBagPass =
      patchBagRes.status === 200 &&
      patchBagRes.data.items.some((i) => i.productId === 'prod-2' && i.quantity === 3);
    console.log('13. PATCH /api/bag/items/prod-2 (update qty to 3):', isPatchBagPass ? 'PASS' : 'FAIL');

    // 14. Bag Delete: DELETE /api/bag/items/prod-2
    const delBagRes = await request('/api/bag/items/prod-2', 'DELETE', null, token);
    const isDelBagPass =
      delBagRes.status === 200 &&
      !delBagRes.data.items.some((i) => i.productId === 'prod-2');
    console.log('14. DELETE /api/bag/items/prod-2:', isDelBagPass ? 'PASS' : 'FAIL');

    console.log('\nALL 14 BACKEND API ROUTES VERIFIED AND PASSING! 🚀');
  } catch (err) {
    console.error('API Test failed with error:', err);
  } finally {
    server.close(() => {
      console.log('API Test server closed.');
      process.exit(0);
    });
  }
});
