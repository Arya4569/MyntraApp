const http = require('http');
const app = require('./src/server');
const Product = require('./src/models/Product');
const Bag = require('./src/models/Bag');
const db = require('./src/db');

const PORT = 5097;
let server;

const request = (method, path, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path,
        method,
        headers: defaultHeaders,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const contentType = res.headers['content-type'] || '';
          let data;
          if (contentType.includes('application/json')) {
            try {
              data = JSON.parse(buffer.toString('utf-8'));
            } catch {
              data = buffer.toString('utf-8');
            }
          } else {
            data = buffer.toString('utf-8');
          }
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      }
    );

    req.on('error', reject);

    if (body) {
      if (typeof body === 'string') {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
};

const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  } else {
    console.log(`✓ PASS: ${message}`);
  }
};

async function runCartTests() {
  console.log('\n============================================================');
  console.log('🧪 RUNNING TASK 5: SMART CART & SAVE FOR LATER TESTS');
  console.log('============================================================\n');

  await new Promise((resolve) => {
    server = app.listen(PORT, '0.0.0.0', resolve);
  });
  console.log(`Cart test server listening on port ${PORT}...`);

  try {
    // 1. Authenticate User A (Demo User)
    const loginA = await request('POST', '/api/auth/login', {
      email: 'aryak@fashion.dev',
      password: 'Password123!',
    });
    assert(loginA.status === 200, 'User A (Demo user) login succeeds');
    const tokenA = loginA.data.token;
    const userA = loginA.data.user;
    const authA = { Authorization: `Bearer ${tokenA}` };

    // 2. Register & Authenticate User B (for user isolation test)
    const uniqueB = `user_cart_b_${Date.now()}`;
    const registerB = await request('POST', '/api/auth/register', {
      fullName: 'Rhea Kapoor',
      email: `${uniqueB}@fashion.dev`,
      mobileNumber: `91${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: 'Password123!',
      gender: 'Women',
    });
    assert(registerB.status === 201, 'User B registered successfully');
    const tokenB = registerB.data.token;
    const userB = registerB.data.user;
    const authB = { Authorization: `Bearer ${tokenB}` };

    // 3. Clear existing bags for clean baseline
    await request('DELETE', '/api/bag', null, authA);
    await request('DELETE', '/api/bag', null, authB);
    const cleanBagA = await request('GET', '/api/bag', null, authA);
    assert(cleanBagA.data.items.length === 0, 'User A initial bag is empty');

    // Fetch sample products from catalog
    const productsRes = await request('GET', '/api/products');
    assert(productsRes.status === 200 && productsRes.data.products.length >= 2, 'Catalogue has test products');
    const prod1 = productsRes.data.products[0];
    const prod2 = productsRes.data.products[1];
    const validSize = prod1.sizes && prod1.sizes.length > 0 ? prod1.sizes[0] : 'M';

    // 4. Test: Add item with valid variant & quantity
    const addRes1 = await request(
      'POST',
      '/api/bag/items',
      {
        productId: prod1.id,
        size: validSize,
        quantity: 2,
      },
      authA
    );
    assert(addRes1.status === 200 || addRes1.status === 201, 'Add valid item to bag succeeds');
    assert(addRes1.data.items.length === 1, 'Bag contains 1 item');
    assert(addRes1.data.items[0].quantity === 2, 'Item quantity is 2');
    assert(addRes1.data.items[0].size === validSize, 'Item size matches selected variant');
    assert(addRes1.data.totals.subtotal === prod1.price * 2, 'Backend calculates trusted subtotal based on catalog price');
    const item1Id = addRes1.data.items[0].id;

    // 5. Test: Reject adding invalid variant (size not in product.sizes)
    const invalidVariantRes = await request(
      'POST',
      '/api/bag/items',
      {
        productId: prod1.id,
        size: 'NON_EXISTENT_SIZE_999',
        quantity: 1,
      },
      authA
    );
    assert(invalidVariantRes.status === 400, 'Adding non-existent size variant is rejected with 400');

    // 6. Test: Prevent quantity from exceeding available stock
    const excessiveQtyRes = await request(
      'POST',
      '/api/bag/items',
      {
        productId: prod2.id,
        size: prod2.sizes[0] || 'M',
        quantity: (prod2.stockCount || 10) + 50,
      },
      authA
    );
    assert(excessiveQtyRes.status === 400, 'Adding quantity exceeding available stock is rejected with 400');

    // 7. Test: Update item quantity and verify subtotal recalculation
    const updateQtyRes = await request(
      'PUT',
      `/api/bag/items/${item1Id}`,
      {
        quantity: 3,
      },
      authA
    );
    assert(updateQtyRes.status === 200, 'Update quantity to 3 succeeds');
    assert(updateQtyRes.data.items[0].quantity === 3, 'Item quantity updated to 3');
    assert(updateQtyRes.data.totals.subtotal === prod1.price * 3, 'Totals updated using trusted backend price');

    // 8. Test: Reject updating quantity beyond stock limit
    const updateExcessiveRes = await request(
      'PUT',
      `/api/bag/items/${item1Id}`,
      {
        quantity: 9999,
      },
      authA
    );
    assert(updateExcessiveRes.status === 400, 'Updating quantity beyond stock limit returns 400');

    // 9. Test: Add second product to bag
    const addRes2 = await request(
      'POST',
      '/api/bag/items',
      {
        productId: prod2.id,
        size: prod2.sizes[0] || 'M',
        quantity: 1,
      },
      authA
    );
    assert(addRes2.status === 200 || addRes2.status === 201, 'Second product added to bag');
    assert(addRes2.data.items.length === 2, 'Bag now contains 2 distinct items');
    const item2Id = addRes2.data.items.find((i) => i.productId === prod2.id).id;

    // 10. Test Save For Later: Move item 1 out of active cart into Save for Later
    const saveRes = await request(
      'POST',
      '/api/bag/save-for-later',
      {
        itemId: item1Id,
      },
      authA
    );
    assert(saveRes.status === 200, 'Item moved to Save for Later successfully');
    assert(saveRes.data.cart.length === 1, 'Active bag now contains only 1 item');
    assert(saveRes.data.cart[0].id === item2Id, 'Active bag retains only the second item');
    assert(saveRes.data.savedForLater.length === 1, 'Save for Later list has 1 item');
    assert(saveRes.data.savedForLater[0].productId === prod1.id, 'Saved item matches moved product');
    const savedItemId = saveRes.data.savedForLater[0].id;

    // 11. Test: Fetch Save for Later list independently
    const getSavedRes = await request('GET', '/api/bag/saved-for-later', null, authA);
    assert(getSavedRes.status === 200, 'GET /api/bag/saved-for-later succeeds');
    assert(getSavedRes.data.savedForLater.length === 1, 'Fetched saved list contains 1 item');
    assert(getSavedRes.data.savedForLater[0].product.id === prod1.id, 'Saved item has populated product details');
    assert(getSavedRes.data.savedForLater[0].isAvailable === true, 'Saved item availability validated');

    // 12. Test: Move saved item back to Cart
    const moveBackRes = await request(
      'POST',
      '/api/bag/move-to-cart',
      {
        itemId: savedItemId,
      },
      authA
    );
    assert(moveBackRes.status === 200, 'Item moved back to cart successfully');
    assert(moveBackRes.data.cart.length === 2, 'Active bag restored to 2 items');
    assert(moveBackRes.data.savedForLater.length === 0, 'Saved for Later list is now empty');

    // 13. Test: Save item 2 for later and test removing it from saved items
    const save2Res = await request(
      'POST',
      '/api/bag/save-for-later',
      {
        itemId: item2Id,
      },
      authA
    );
    assert(save2Res.status === 200, 'Item 2 moved to Save for Later');
    const saved2Id = save2Res.data.savedForLater[0].id;

    const removeSavedRes = await request(
      'DELETE',
      `/api/bag/saved-for-later/${saved2Id}`,
      null,
      authA
    );
    assert(removeSavedRes.status === 200, 'Delete saved item succeeds');
    assert(removeSavedRes.data.savedForLater.length === 0, 'Saved list empty after deletion');

    // 14. Test: Guest Cart & Saved Items Merge on Login
    const guestCartItems = [
      {
        id: `guest_cart_${Date.now()}`,
        productId: prod2.id,
        size: prod2.sizes[0] || 'M',
        quantity: 2,
      },
    ];
    const guestSavedItems = [
      {
        id: `guest_saved_${Date.now()}`,
        productId: prod1.id,
        size: validSize,
      },
    ];

    const mergeRes = await request(
      'POST',
      '/api/bag/merge',
      {
        cartItems: guestCartItems,
        savedForLaterItems: guestSavedItems,
      },
      authB
    );
    assert(mergeRes.status === 200, 'Guest items merged for User B on login');
    assert(mergeRes.data.cart.length === 1, 'User B has 1 merged cart item');
    assert(mergeRes.data.cart[0].productId === prod2.id, 'User B merged cart item matches guest product');
    assert(mergeRes.data.savedForLater.length === 1, 'User B has 1 merged saved item');
    assert(mergeRes.data.savedForLater[0].productId === prod1.id, 'User B merged saved item matches guest product');

    // 15. Test: User Isolation (User B cannot access or modify User A's cart items)
    const userAItems = (await request('GET', '/api/bag', null, authA)).data.items;
    assert(userAItems.length >= 1, 'User A has active cart items');
    const targetAItemId = userAItems[0].id;

    // User B tries to update User A's item
    const hijackUpdateRes = await request(
      'PUT',
      `/api/bag/items/${targetAItemId}`,
      { quantity: 5 },
      authB
    );
    assert(hijackUpdateRes.status === 404, 'User B cannot update User A cart item (returns 404)');

    // User B tries to delete User A's item
    const hijackDeleteRes = await request(
      'DELETE',
      `/api/bag/items/${targetAItemId}`,
      null,
      authB
    );
    assert(hijackDeleteRes.status === 404, 'User B cannot delete User A cart item (returns 404)');

    // User B tries to save User A's item for later
    const hijackSaveRes = await request(
      'POST',
      '/api/bag/save-for-later',
      { itemId: targetAItemId },
      authB
    );
    assert(hijackSaveRes.status === 404, 'User B cannot save User A item for later (returns 404)');

    // 16. Test: Pre-checkout Cart Validation endpoint
    const validateRes = await request('GET', '/api/bag/validate', null, authA);
    assert(validateRes.status === 200, 'GET /api/bag/validate succeeds');
    assert(validateRes.data.isValid === true, 'Cart validation passes for valid available products');

    // 17. Test Checkout Integration: Order creation includes ONLY active cart, NOT saved items
    // First, ensure User A has 1 active cart item and 1 saved for later item
    await request('POST', '/api/bag/save-for-later', { itemId: userAItems[0].id }, authA);
    // Add prod2 to active bag
    const addCheckoutItem = await request(
      'POST',
      '/api/bag/items',
      {
        productId: prod2.id,
        size: prod2.sizes[0] || 'M',
        quantity: 1,
      },
      authA
    );
    assert(addCheckoutItem.data.items.length === 1, 'User A has 1 active cart item for checkout');
    const savedBeforeOrder = await request('GET', '/api/bag/saved-for-later', null, authA);
    assert(savedBeforeOrder.data.savedForLater.length >= 1, 'User A has at least 1 saved item before checkout');
    const savedCountBeforeOrder = savedBeforeOrder.data.savedForLater.length;

    // Create order using checkout
    const orderPayload = {
      items: [
        {
          productId: prod2.id,
          quantity: 1,
          size: prod2.sizes[0] || 'M',
          price: 1, // Tampered client price — backend must use trusted catalog price!
        },
      ],
      shippingAddress: {
        name: 'Aryak Fashion Test',
        addressLine: '123 Fashion Blvd',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        phone: '9876543210',
      },
      paymentMethod: 'COD',
      bagSummary: {
        totalMRP: prod2.originalPrice || prod2.price,
        discount: (prod2.originalPrice || prod2.price) - prod2.price,
        couponDiscount: 0,
        shippingFee: 0,
        finalPayable: prod2.price,
      },
    };

    const orderRes = await request('POST', '/api/orders', orderPayload, authA);
    assert(orderRes.status === 201, 'Order created successfully with trusted catalog prices');
    assert(orderRes.data.order.items.length === 1, 'Order contains only 1 active cart item');
    assert(orderRes.data.order.items[0].price === prod2.price, 'Order trusted catalog price takes precedence over client submission');

    // Verify Save for Later items were NOT modified or placed in order
    const savedAfterOrder = await request('GET', '/api/bag/saved-for-later', null, authA);
    assert(
      savedAfterOrder.data.savedForLater.length === savedCountBeforeOrder,
      'Saved for Later items remain untouched after active bag checkout'
    );

    // 18. Test: Clear bag removes active items without touching saved items
    await request('POST', '/api/bag/items', { productId: prod1.id, size: validSize, quantity: 1 }, authA);
    const clearRes = await request('DELETE', '/api/bag', null, authA);
    assert(clearRes.status === 200, 'DELETE /api/bag succeeds');
    assert(clearRes.data.items.length === 0, 'Active bag items cleared');
    const savedAfterClear = await request('GET', '/api/bag/saved-for-later', null, authA);
    assert(savedAfterClear.data.savedForLater.length === savedCountBeforeOrder, 'Clear bag leaves saved for later items untouched');

    console.log('\n============================================================');
    console.log('🎉 ALL TASK 5: SMART CART & SAVE FOR LATER TESTS PASSED!');
    console.log('============================================================\n');
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log('Test server closed.');
    }
  }
}

runCartTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
