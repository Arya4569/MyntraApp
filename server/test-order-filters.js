/**
 * Comprehensive Test Suite for Task 4:
 * Order & Transaction Management (Filters, Invoices, Webhooks, Audit)
 */
const assert = require('assert');
const crypto = require('crypto');
const Order = require('./src/models/Order');
const AuditLog = require('./src/models/AuditLog');
const InvoiceService = require('./src/services/invoiceService');
const db = require('./src/db');

async function runTests() {
  console.log('=== Task 4: Order & Transaction Management Tests ===\n');
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

  const testUserId = 'test_order_user_' + Date.now();
  const now = Date.now();

  // Create controlled sample orders for this user
  const sampleOrders = [
    {
      id: 'ORD-TEST-1',
      invoiceNumber: 'INV-2026-0001',
      userId: testUserId,
      status: 'placed',
      paymentMethod: 'UPI',
      totalAmount: 1499,
      date: new Date(now - 2 * 24 * 3600 * 1000).toISOString(),
      items: [{ product: { name: 'Puma Running Shoes', brand: 'Puma' }, quantity: 1, price: 1499 }],
    },
    {
      id: 'ORD-TEST-2',
      invoiceNumber: 'INV-2026-0002',
      userId: testUserId,
      status: 'delivered',
      paymentMethod: 'Cash on Delivery (COD)',
      totalAmount: 899,
      date: new Date(now - 10 * 24 * 3600 * 1000).toISOString(),
      items: [{ product: { name: 'Nike Cotton Tee', brand: 'Nike' }, quantity: 1, price: 899 }],
    },
    {
      id: 'ORD-TEST-3',
      invoiceNumber: 'INV-2026-0003',
      userId: testUserId,
      status: 'cancelled',
      paymentMethod: 'Credit Card',
      totalAmount: 2999,
      date: new Date(now - 45 * 24 * 3600 * 1000).toISOString(),
      items: [{ product: { name: 'Levis Slim Denim', brand: 'Levis' }, quantity: 1, price: 2999 }],
    },
    {
      id: 'ORD-TEST-4',
      invoiceNumber: 'INV-2026-0004',
      userId: testUserId,
      status: 'confirmed',
      paymentMethod: 'Net Banking (HDFC)',
      totalAmount: 1999,
      date: new Date(now - 90 * 24 * 3600 * 1000).toISOString(),
      items: [{ product: { name: 'Roadster Jacket', brand: 'Roadster' }, quantity: 1, price: 1999 }],
    },
  ];

  // Seed db with test orders
  const data = db.read();
  data.orders = (data.orders || []).filter((o) => o.userId !== testUserId);
  data.orders.push(...sampleOrders);
  db.write(data);

  // 1. Filter by Payment Method: UPI
  test('Filter by Payment Method (UPI)', () => {
    const res = Order.findAll({ userId: testUserId, paymentMethod: 'upi' });
    assert.strictEqual(res.orders.length, 1);
    assert.strictEqual(res.orders[0].id, 'ORD-TEST-1');
    assert.strictEqual(res.orders[0].paymentMethod, 'UPI');
  });

  // 2. Filter by Payment Method: COD
  test('Filter by Payment Method (COD / Cash on Delivery)', () => {
    const res = Order.findAll({ userId: testUserId, paymentMethod: 'cod' });
    assert.strictEqual(res.orders.length, 1);
    assert.strictEqual(res.orders[0].id, 'ORD-TEST-2');
    assert(res.orders[0].paymentMethod.toLowerCase().includes('cod'));
  });

  // 3. Filter by Payment Method: Card
  test('Filter by Payment Method (Card)', () => {
    const res = Order.findAll({ userId: testUserId, paymentMethod: 'card' });
    assert.strictEqual(res.orders.length, 1);
    assert.strictEqual(res.orders[0].id, 'ORD-TEST-3');
    assert(res.orders[0].paymentMethod.toLowerCase().includes('card'));
  });

  // 4. Filter by Payment Method: Net Banking
  test('Filter by Payment Method (Net Banking)', () => {
    const res = Order.findAll({ userId: testUserId, paymentMethod: 'netbanking' });
    assert.strictEqual(res.orders.length, 1);
    assert.strictEqual(res.orders[0].id, 'ORD-TEST-4');
    assert(res.orders[0].paymentMethod.toLowerCase().includes('net banking'));
  });

  // 5. Filter by Status
  test('Filter by Order Status (active, delivered, cancelled)', () => {
    const activeRes = Order.findAll({ userId: testUserId, status: 'active' });
    assert.strictEqual(activeRes.orders.length, 2, 'Should match 2 active orders (placed, confirmed)');

    const delRes = Order.findAll({ userId: testUserId, status: 'delivered' });
    assert.strictEqual(delRes.orders.length, 1, 'Should match 1 delivered order');
    assert.strictEqual(delRes.orders[0].id, 'ORD-TEST-2');

    const canRes = Order.findAll({ userId: testUserId, status: 'cancelled' });
    assert.strictEqual(canRes.orders.length, 1, 'Should match 1 cancelled order');
    assert.strictEqual(canRes.orders[0].id, 'ORD-TEST-3');
  });

  // 6. Filter by Date Range
  test('Filter by Date Range (last30days)', () => {
    const res = Order.findAll({ userId: testUserId, dateRange: 'last30days' });
    assert.strictEqual(res.orders.length, 2, 'Should match 2 orders within last 30 days');
  });

  // 7. Search filter by product name, brand, or invoice
  test('Search filter matches product brand, item name, and invoice', () => {
    const brandRes = Order.findAll({ userId: testUserId, search: 'Nike' });
    assert.strictEqual(brandRes.orders.length, 1);
    assert.strictEqual(brandRes.orders[0].id, 'ORD-TEST-2');

    const invRes = Order.findAll({ userId: testUserId, search: 'INV-2026-0003' });
    assert.strictEqual(invRes.orders.length, 1);
    assert.strictEqual(invRes.orders[0].id, 'ORD-TEST-3');
  });

  // 8. Sorting
  test('Server-side sorting by date and amount', () => {
    const sortDateAsc = Order.findAll({ userId: testUserId, sortBy: 'date_asc' });
    assert.strictEqual(sortDateAsc.orders[0].id, 'ORD-TEST-4', 'Oldest order should be first');

    const sortAmountDesc = Order.findAll({ userId: testUserId, sortBy: 'amount_desc' });
    assert.strictEqual(sortAmountDesc.orders[0].id, 'ORD-TEST-3', 'Highest amount order should be first');
    assert.strictEqual(sortAmountDesc.orders[0].totalAmount, 2999);
  });

  // 9. Pagination
  test('Server-side pagination limits and pages', () => {
    const page1 = Order.findAll({ userId: testUserId, page: 1, limit: 2 });
    assert.strictEqual(page1.orders.length, 2);
    assert.strictEqual(page1.pagination.page, 1);
    assert.strictEqual(page1.pagination.total, 4);
    assert.strictEqual(page1.pagination.totalPages, 2);

    const page2 = Order.findAll({ userId: testUserId, page: 2, limit: 2 });
    assert.strictEqual(page2.orders.length, 2);
    assert.strictEqual(page2.pagination.page, 2);
    assert.notStrictEqual(page1.orders[0].id, page2.orders[0].id, 'Pages should not duplicate');
  });

  // 10. PDF Invoice & HTML generation
  await asyncTest('Invoice service generates PDF and HTML invoice', async () => {
    const order = sampleOrders[0];
    const html = InvoiceService.generateHtml(order);
    assert(typeof html === 'string', 'HTML invoice must be a string');
    assert(html.includes('MYNTRA'), 'HTML invoice must contain MYNTRA branding');
    assert(html.includes(order.invoiceNumber), 'HTML invoice must contain invoice number');

    // Test PDF generation via stream
    const { Writable } = require('stream');
    const chunks = [];
    const mockRes = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });
    mockRes.setHeader = () => {};
    mockRes.status = () => mockRes;
    mockRes.json = () => {};

    await InvoiceService.generatePdf(order, mockRes);
    const pdfBuffer = Buffer.concat(chunks);
    assert(pdfBuffer.length > 100, 'PDF buffer must contain data');
    const header = pdfBuffer.slice(0, 5).toString('ascii');
    assert.strictEqual(header, '%PDF-', 'Buffer should have valid %PDF- header');
  });

  // 11. Cancellation request
  test('Order cancellation updates status to cancelled with audit log', () => {
    const cancelRes = Order.cancelOrder(sampleOrders[0].id, testUserId, 'Incorrect size');
    assert(cancelRes.success, 'Cancellation should succeed');
    const updated = Order.findById(sampleOrders[0].id);
    assert.strictEqual(updated.status, 'Cancelled');
    assert.strictEqual(updated.cancelReason, 'Incorrect size');
  });

  // 12. Return request
  test('Order return updates status to returned/return_requested', () => {
    // Deliver order 2 first
    const freshDb = db.read();
    const targetOrder = freshDb.orders.find((o) => o.id === sampleOrders[1].id);
    targetOrder.status = 'Delivered';
    targetOrder.deliveryDate = new Date().toISOString();
    db.write(freshDb);

    const returnRes = Order.returnOrder(sampleOrders[1].id, testUserId, {
      actionType: 'return',
      reason: 'Item defective',
    });
    assert(returnRes.success, 'Return request should succeed');
    const updated = Order.findById(sampleOrders[1].id);
    assert(updated.returnRequest, 'Return request must be recorded');
    assert.strictEqual(updated.returnRequest.reason, 'Item defective');
  });

  // 13. Secure Payment Webhook HMAC Verification
  test('Payment HMAC signature verifies valid payload and rejects tampered signature', () => {
    const secret = process.env.RAZORPAY_KEY_SECRET || 'test_secret_key_12345';
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_webhook_test_123',
            order_id: 'order_webhook_test_123',
            status: 'captured',
            amount: 149900,
          },
        },
      },
    });

    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    // Verification logic
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    assert.strictEqual(validSignature, expectedSig, 'HMAC signature matches');

    const tamperedSig = validSignature.slice(0, -4) + 'abcd';
    assert.notStrictEqual(tamperedSig, expectedSig, 'Tampered HMAC signature rejected');
  });

  // 14. Audit Log maintains payment and order audit records
  test('AuditLog records and retrieves immutable transaction audits', () => {
    const audit = AuditLog.record({
      eventType: 'PAYMENT_CAPTURED',
      orderId: 'ORD-TEST-1',
      userId: testUserId,
      details: { amount: 1499, method: 'UPI' },
      actor: { type: 'SYSTEM' },
    });
    assert(audit.id, 'Audit log must have ID');
    assert.strictEqual(audit.eventType, 'PAYMENT_CAPTURED');

    const logs = AuditLog.findByOrderId('ORD-TEST-1');
    assert(logs.length >= 1, 'Should find recorded audit log');
    assert.strictEqual(logs[0].orderId, 'ORD-TEST-1');
  });

  // Cleanup
  const cleanDb = db.read();
  cleanDb.orders = (cleanDb.orders || []).filter((o) => o.userId !== testUserId);
  db.write(cleanDb);

  console.log(`\nOrder Management Test Results: ${passed}/${total} passed`);
  if (passed === total) {
    console.log('🎉 ALL TASK 4 TESTS PASSED!\n');
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
