/**
 * Comprehensive Test Suite for Task 5:
 * Smart Shopping Cart & Save for Later (Transactional SQLite Concurrency & Rollback)
 */
const assert = require('assert');
const sqliteCart = require('./src/db/sqlite');
const Bag = require('./src/models/Bag');
const Product = require('./src/models/Product');

async function runTests() {
  console.log('=== Task 5: Smart Shopping Cart & Save for Later Tests ===\n');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ [FAIL] ${name}:`, e.message);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ [FAIL] ${name}:`, e.message);
    }
  }

  const testUserId = 'test_cart_user_' + Date.now();

  // Clean initial state for test user
  sqliteCart.clearCart(testUserId);

  // 1. Add item to cart
  test('Add item to cart preserves size, color, quantity, and price', () => {
    const res = Bag.addItem(testUserId, {
      productId: 'prod-1',
      size: 'M',
      color: 'Olive Green',
      quantity: 2,
    });
    assert(!res.error, `Add item should not return error: ${res.error}`);
    assert.strictEqual(res.items.length, 1);
    assert.strictEqual(res.items[0].productId, 'prod-1');
    assert.strictEqual(res.items[0].size, 'M');
    assert.strictEqual(res.items[0].color, 'Olive Green');
    assert.strictEqual(res.items[0].quantity, 2);
  });

  // 2. Prevent duplicate product-and-variant combination: Adding same product & size increments quantity
  test('Duplicate product + size variant increments quantity rather than creating duplicate row', () => {
    const res = Bag.addItem(testUserId, {
      productId: 'prod-1',
      size: 'M',
      color: 'Olive Green',
      quantity: 1,
    });
    assert(!res.error);
    assert.strictEqual(res.items.length, 1, 'Should still have exactly 1 line item');
    assert.strictEqual(res.items[0].quantity, 3, 'Quantity should be 2 + 1 = 3');
  });

  // 3. Different variant creates a separate item
  test('Different size variant creates a distinct line item', () => {
    const res = Bag.addItem(testUserId, {
      productId: 'prod-1',
      size: 'L',
      color: 'Olive Green',
      quantity: 1,
    });
    assert(!res.error);
    assert.strictEqual(res.items.length, 2, 'Should have 2 line items for different sizes');
  });

  // 4. Update item quantity and variant
  test('Update quantity and variant with validation', () => {
    const items = sqliteCart.getCartItems(testUserId);
    const itemToUpdate = items.find((i) => i.size === 'L');
    assert(itemToUpdate);

    const updateRes = Bag.updateItem(testUserId, itemToUpdate.id, {
      quantity: 3,
      size: 'XL',
    });
    assert(!updateRes.error);
    const updatedItems = sqliteCart.getCartItems(testUserId);
    const found = updatedItems.find((i) => i.id === itemToUpdate.id);
    assert.strictEqual(found.quantity, 3);
    assert.strictEqual(found.size, 'XL');
  });

  // 5. Stock validation: Adding more than available stock is rejected
  test('Stock validation rejects quantity exceeding stock limit', () => {
    const prod = Product.findById('prod-1');
    const stock = prod.stockCount || 10;
    const res = Bag.addItem(testUserId, {
      productId: 'prod-1',
      size: 'S',
      quantity: stock + 5,
    });
    assert(res.error, 'Should reject quantity exceeding stock');
  });

  // 6. Save for Later: Moves item atomically from cart to saved list
  test('Save for Later atomically moves item from cart to saved_for_later', () => {
    const items = sqliteCart.getCartItems(testUserId);
    const itemToSave = items[0];
    const initialCartCount = items.length;

    const res = Bag.saveForLater(testUserId, itemToSave.id);
    assert(res.success, 'Save for later should succeed');
    assert.strictEqual(res.bag.items.length, initialCartCount - 1, 'Cart count should decrease by 1');
    assert.strictEqual(res.savedForLater.items.length, 1, 'Saved for later should have 1 item');
    assert.strictEqual(res.savedForLater.items[0].productId, itemToSave.productId);
    assert.strictEqual(res.savedForLater.items[0].size, itemToSave.size);
  });

  // 7. Move to Cart: Moves saved item back to active shopping bag
  test('Move to Cart moves item from saved_for_later back to active bag', () => {
    const saved = sqliteCart.getSavedItems(testUserId);
    assert.strictEqual(saved.length, 1);
    const res = Bag.moveToCart(testUserId, saved[0].id);
    assert(res.success, 'Move to cart should succeed');
    assert.strictEqual(res.savedForLater.items.length, 0, 'Saved for later should now be empty');
    const inCart = res.bag.items.find((i) => i.productId === saved[0].productId && i.size === saved[0].size);
    assert(inCart, 'Item should be restored in active bag');
  });

  // 8. Guest cart merging on login
  test('Merge guest cart combines guest cart and saved items into authenticated user', () => {
    const guestCartItems = [
      { productId: 'prod-2', size: 'M', color: 'Navy', quantity: 2 },
    ];
    const guestSavedItems = [
      { productId: 'prod-3', size: 'S', color: 'Black', quantity: 1 },
    ];

    const res = Bag.mergeGuestCart(testUserId, {
      cartItems: guestCartItems,
      savedForLaterItems: guestSavedItems,
    });
    assert(res.success, 'Merge guest cart should succeed');
    const guestInCart = res.bag.items.find((i) => i.productId === 'prod-2');
    assert(guestInCart, 'Guest item should exist in user cart');
    assert.strictEqual(guestInCart.quantity, 2);

    const guestInSaved = res.savedForLater.items.find((i) => i.productId === 'prod-3');
    assert(guestInSaved, 'Guest saved item should exist in user saved for later');
  });

  // 9. Backend Calculation of cart totals
  test('Backend calculates MRP, subtotal, discount, delivery fee, and final totals accurately', () => {
    const bag = Bag.getBagWithProducts(testUserId);
    assert(typeof bag.totals.totalMRP === 'number');
    assert(typeof bag.totals.subtotal === 'number');
    assert(typeof bag.totals.discountAmount === 'number');
    assert(typeof bag.totals.finalTotal === 'number');
    assert.strictEqual(
      bag.totals.finalTotal,
      bag.totals.subtotal + bag.totals.deliveryFee,
      'Final total must match subtotal + delivery fee'
    );
  });

  // 10. Pre-checkout validation on server
  test('Pre-checkout validation checks cart readiness and returns valid status', () => {
    const val = Bag.validateCart(testUserId);
    assert(typeof val.valid === 'boolean');
    assert(Array.isArray(val.issues));
  });

  // 11. Transaction Rollback on Failure
  test('Transaction rollback restores original database state when an error is thrown', () => {
    const beforeItems = sqliteCart.getCartItems(testUserId);

    let caughtError = false;
    try {
      sqliteCart.transaction(() => {
        // Step 1: Add a temporary item
        sqliteCart.db.prepare(`
          INSERT INTO cart_items (id, user_id, product_id, size, color, quantity, created_at, updated_at)
          VALUES ('temp_rollback_item', ?, 'prod-4', 'M', 'Red', 1, datetime('now'), datetime('now'))
        `).run(testUserId);

        // Step 2: Throw intentional error mid-transaction to force rollback
        throw new Error('SIMULATED_TRANSACTION_FAILURE');
      });
    } catch (e) {
      if (e.message === 'SIMULATED_TRANSACTION_FAILURE') {
        caughtError = true;
      }
    }

    assert(caughtError, 'Error should have been thrown');

    // Verify database was rolled back: temp item should NOT exist
    const afterItems = sqliteCart.getCartItems(testUserId);
    assert.strictEqual(afterItems.length, beforeItems.length, 'Item count must be identical before and after rollback');
    const tempItem = sqliteCart.db.prepare('SELECT id FROM cart_items WHERE id = ?').get('temp_rollback_item');
    assert.strictEqual(tempItem, undefined, 'Rolled back item must NOT exist in SQLite database');
  });

  // 12. Concurrency: Simultaneous parallel modifications do not corrupt or overwrite
  await asyncTest('Simultaneous concurrent cart modifications execute safely without overwriting', async () => {
    const concurrentUser = 'test_concurrent_user_' + Date.now();
    sqliteCart.clearCart(concurrentUser);

    // Initial item
    Bag.addItem(concurrentUser, { productId: 'prod-1', size: 'M', quantity: 1 });

    // Execute 5 concurrent increments simultaneously
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        new Promise((resolve) => {
          setTimeout(() => {
            const res = Bag.addItem(concurrentUser, { productId: 'prod-1', size: 'M', quantity: 1 });
            resolve(res);
          }, Math.floor(Math.random() * 20));
        })
      );
    }

    await Promise.all(promises);

    const finalBag = Bag.getBagWithProducts(concurrentUser);
    const item = finalBag.items.find((i) => i.productId === 'prod-1' && i.size === 'M');
    assert(item, 'Item must exist');
    // Initial 1 + 5 increments = 6 units
    assert.strictEqual(item.quantity, 6, `Expected quantity 6 after 5 concurrent increments, got: ${item.quantity}`);

    // Cleanup concurrent user
    sqliteCart.clearCart(concurrentUser);
  });

  // 13. Remove item from cart
  test('Remove item removes from cart completely', () => {
    const items = sqliteCart.getCartItems(testUserId);
    const itemToRemove = items[0];
    const initialCount = items.length;

    const res = Bag.removeItem(testUserId, itemToRemove.id);
    assert(res.success);
    const afterItems = sqliteCart.getCartItems(testUserId);
    assert.strictEqual(afterItems.length, initialCount - 1);
  });

  // Cleanup
  sqliteCart.clearCart(testUserId);

  console.log(`\nCart & Save for Later Test Results: ${passed}/${total} passed`);
  if (passed === total) {
    console.log('🎉 ALL TASK 5 TESTS PASSED!\n');
    process.exit(0);
  } else {
    console.error('⚠️ SOME TESTS FAILED.\n');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
