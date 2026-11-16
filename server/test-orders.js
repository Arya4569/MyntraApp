const http = require('http');
const app = require('./src/server');
const Product = require('./src/models/Product');
const db = require('./src/db');

const PORT = 5096;
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
            data = buffer;
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

async function runOrderTests() {
  console.log('\n===============================================');
  console.log('🧪 RUNNING TASK 4: ORDER & TRANSACTION TESTS');
  console.log('===============================================\n');

  await new Promise((resolve) => {
    server = app.listen(PORT, '0.0.0.0', resolve);
  });
  console.log(`Order test server listening on port ${PORT}...`);

  try {
    // 1. Authenticate User A (Demo User)
    const loginA = await request('POST', '/api/auth/login', {
      email: 'aryak@fashion.dev',
      password: 'Password123!',
    });
    assert(loginA.status === 200, 'User A (Demo user) login succeeds');
    const tokenA = loginA.data.token;
    const userA = loginA.data.user;
    const authHeadersA = { Authorization: `Bearer ${tokenA}` };

    // 2. Register and Authenticate User B (Isolation testing)
    const uniqueB = `user_b_${Date.now()}`;
    const registerB = await request('POST', '/api/auth/register', {
      fullName: 'Vikram Malhotra',
      email: `${uniqueB}@fashion.dev`,
      mobileNumber: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: 'Password123!',
      gender: 'Men',
    });
    assert(registerB.status === 201, 'User B registered for isolation tests');
    const tokenB = registerB.data.token;
    const userB = registerB.data.user;
    const authHeadersB = { Authorization: `Bearer ${tokenB}` };

    // Reset stock of prod-1 to known count (e.g. 50)
    Product.updateStock('prod-1', true, 50);
    const prod1Before = Product.findById('prod-1');
    const initialProd1Stock = prod1Before.stockCount;
    const originalProd1Price = prod1Before.price;

    // -------------------------------------------------------------
    // Test 1: Order Creation with Persisted Item Snapshots & Stock Decrement
    // -------------------------------------------------------------
    console.log('\n--- 1. Order Creation & Snapshot Verification ---');
    const createRes1 = await request(
      'POST',
      '/api/orders',
      {
        items: [
          {
            productId: 'prod-1',
            quantity: 2,
            size: 'L',
            color: 'Olive Green',
            product: {
              id: 'prod-1',
              name: prod1Before.name,
              brand: prod1Before.brand,
              price: prod1Before.price,
              originalPrice: prod1Before.originalPrice,
              image: prod1Before.image,
            },
          },
        ],
        shippingAddress: '402 Sea Green, Mumbai',
        paymentMethod: 'UPI / Razorpay',
        razorpay_order_id: 'order_test_123',
        razorpay_payment_id: 'pay_test_123',
      },
      authHeadersA
    );

    assert(createRes1.status === 201, 'Order created successfully for User A');
    const order1 = createRes1.data.order;
    assert(order1.userId === userA.id, 'Order belongs to User A');
    assert(order1.items.length === 1, 'Order contains 1 item');
    assert(order1.items[0].product.price === originalProd1Price, 'Snapshot contains purchase price');
    assert(order1.items[0].size === 'L', 'Snapshot retains size L');
    assert(order1.items[0].quantity === 2, 'Snapshot retains quantity 2');
    assert(order1.items[0].subtotal === originalProd1Price * 2, 'Snapshot subtotal is accurate');
    assert(order1.invoiceNumber && order1.invoiceNumber.startsWith('INV-'), 'Order has invoice number generated');

    // Verify stock decrement
    const prod1After = Product.findById('prod-1');
    assert(
      prod1After.stockCount === initialProd1Stock - 2,
      `Inventory stock decremented by 2 (from ${initialProd1Stock} to ${prod1After.stockCount})`
    );

    // -------------------------------------------------------------
    // Test 2: Catalogue Price Change Isolation
    // -------------------------------------------------------------
    console.log('\n--- 2. Catalogue Price Change Isolation ---');
    // Change prod-1 price in catalogue to 9999
    Product.updatePrice('prod-1', 9999);
    const prod1New = Product.findById('prod-1');
    assert(prod1New.price === 9999, 'Catalogue price for prod-1 updated to ₹9999');

    // Fetch order details again
    const fetchOrder1 = await request('GET', `/api/orders/${order1.id}`, null, authHeadersA);
    assert(fetchOrder1.status === 200, 'Fetched historical order');
    assert(
      fetchOrder1.data.order.items[0].product.price === originalProd1Price,
      `Historical order price remains immutable at ₹${originalProd1Price} despite catalogue price changing to ₹9999`
    );

    // Restore original price for sanity
    Product.updatePrice('prod-1', originalProd1Price);

    // -------------------------------------------------------------
    // Test 3: Out-of-Stock Prevention
    // -------------------------------------------------------------
    console.log('\n--- 3. Out-of-Stock Handling ---');
    // Set stock to 1
    Product.updateStock('prod-1', true, 1);
    const failOrder = await request(
      'POST',
      '/api/orders',
      {
        items: [{ productId: 'prod-1', quantity: 5, size: 'M' }],
        paymentMethod: 'Cash on Delivery',
      },
      authHeadersA
    );
    assert(failOrder.status === 400, 'Order creation rejected when requested quantity exceeds available stock (400)');
    assert(failOrder.data.error.includes('Insufficient stock'), 'Error message reports stock shortage');

    // Restore stock
    Product.updateStock('prod-1', true, 45);

    // -------------------------------------------------------------
    // Test 4: Server-Side Pagination
    // -------------------------------------------------------------
    console.log('\n--- 4. Server-Side Pagination ---');
    // Create 2 more orders for User A
    await request(
      'POST',
      '/api/orders',
      {
        items: [{ productId: 'prod-1', quantity: 1, size: 'M' }],
        paymentMethod: 'Cash on Delivery',
        totalAmount: 499,
      },
      authHeadersA
    );
    await request(
      'POST',
      '/api/orders',
      {
        items: [{ productId: 'prod-1', quantity: 3, size: 'XL' }],
        paymentMethod: 'Cash on Delivery',
        totalAmount: 1497,
      },
      authHeadersA
    );

    const page1Res = await request('GET', '/api/orders?page=1&limit=2', null, authHeadersA);
    assert(page1Res.status === 200, 'GET /api/orders page=1 limit=2 responds 200');
    assert(page1Res.data.orders.length === 2, 'Page 1 returns exactly 2 orders');
    assert(page1Res.data.pagination.page === 1, 'Pagination reports page 1');
    assert(page1Res.data.pagination.limit === 2, 'Pagination reports limit 2');
    assert(page1Res.data.pagination.total >= 3, 'Pagination total count >= 3');
    assert(page1Res.data.pagination.totalPages >= 2, 'Pagination totalPages >= 2');
    assert(page1Res.data.pagination.hasMore === true, 'Pagination hasMore is true');

    const page2Res = await request('GET', '/api/orders?page=2&limit=2', null, authHeadersA);
    assert(page2Res.status === 200, 'GET /api/orders page=2 limit=2 responds 200');
    assert(page2Res.data.orders.length >= 1, 'Page 2 returns remaining orders');

    // -------------------------------------------------------------
    // Test 5: Server-Side Filters & Sorting
    // -------------------------------------------------------------
    console.log('\n--- 5. Server-Side Filters & Sorting ---');
    const sortDescRes = await request('GET', '/api/orders?sortBy=amount_desc', null, authHeadersA);
    assert(sortDescRes.status === 200, 'Sorted by amount_desc succeeds');
    const sortedAmounts = sortDescRes.data.orders.map((o) => o.totalAmount);
    assert(
      sortedAmounts[0] >= sortedAmounts[sortedAmounts.length - 1],
      'Highest amount order appears first in amount_desc'
    );

    const searchRes = await request('GET', `/api/orders?search=${order1.id}`, null, authHeadersA);
    assert(searchRes.status === 200, 'Search by Order ID succeeds');
    assert(searchRes.data.orders.some((o) => o.id === order1.id), 'Search returns target order');

    const filterActive = await request('GET', '/api/orders?status=active', null, authHeadersA);
    assert(filterActive.status === 200, 'Filter status=active succeeds');
    assert(
      filterActive.data.orders.every((o) =>
        ['placed', 'confirmed', 'shipped', 'out for delivery'].includes(o.status.toLowerCase())
      ),
      'All orders in active filter have active status'
    );

    // -------------------------------------------------------------
    // Test 6: Server-Side Authorization & User Isolation
    // -------------------------------------------------------------
    console.log('\n--- 6. Server-Side Authorization & User Isolation ---');
    // User B attempts to access User A's order
    const unauthorizedGet = await request('GET', `/api/orders/${order1.id}`, null, authHeadersB);
    assert(
      unauthorizedGet.status === 403,
      'User B is rejected with 403 Forbidden when attempting to view User A\'s order'
    );

    // User B attempts to cancel User A's order
    const unauthorizedCancel = await request(
      'POST',
      `/api/orders/${order1.id}/cancel`,
      { reason: 'Malicious cancellation attempt' },
      authHeadersB
    );
    assert(
      unauthorizedCancel.status === 403,
      'User B is rejected with 403 Forbidden when attempting to cancel User A\'s order'
    );

    // Non-existent order returns 404
    const notFoundRes = await request('GET', '/api/orders/MYN-NONEXISTENT', null, authHeadersA);
    assert(notFoundRes.status === 404, 'Non-existent order returns 404 Not Found');

    // -------------------------------------------------------------
    // Test 7: Invoice PDF & Structured Data Generation
    // -------------------------------------------------------------
    console.log('\n--- 7. Invoice PDF Generation ---');
    const invoiceJsonRes = await request('GET', `/api/orders/${order1.id}/invoice`, null, authHeadersA);
    assert(invoiceJsonRes.status === 200, 'GET /api/orders/:id/invoice returns structured data (200)');
    assert(invoiceJsonRes.data.invoice.orderId === order1.id, 'Invoice orderId matches');
    assert(invoiceJsonRes.data.invoice.items.length === 1, 'Invoice contains order items');
    assert(invoiceJsonRes.data.invoice.taxNote.includes('GST'), 'Invoice contains statutory GST tax note');

    // PDF Download Endpoint
    const invoicePdfRes = await request('GET', `/api/orders/${order1.id}/invoice?format=pdf`, null, authHeadersA);
    assert(invoicePdfRes.status === 200, 'Invoice PDF endpoint responds 200');
    assert(invoicePdfRes.headers['content-type'] === 'application/pdf', 'Invoice Content-Type is application/pdf');
    assert(
      invoicePdfRes.headers['content-disposition']?.includes(`Invoice-${order1.id}.pdf`),
      'Content-Disposition specifies attachment filename'
    );
    const pdfBuffer = invoicePdfRes.data;
    assert(
      pdfBuffer.toString('ascii', 0, 4) === '%PDF',
      'Downloaded stream begins with valid PDF binary magic header %PDF'
    );

    // User B trying to access User A invoice gets 403
    const invoiceUnauth = await request('GET', `/api/orders/${order1.id}/invoice`, null, authHeadersB);
    assert(invoiceUnauth.status === 403, 'User B rejected with 403 Forbidden when requesting User A invoice');

    // -------------------------------------------------------------
    // Test 8: Reorder Flow (Stock verification without auto-charging)
    // -------------------------------------------------------------
    console.log('\n--- 8. Reorder Flow ---');
    const reorderRes = await request('POST', `/api/orders/${order1.id}/reorder`, null, authHeadersA);
    assert(reorderRes.status === 200, 'Reorder endpoint responds 200');
    assert(reorderRes.data.success === true, 'Reorder marked success');
    assert(reorderRes.data.summary.addedCount >= 1, 'Reorder added available items to shopping bag');
    assert(Array.isArray(reorderRes.data.summary.unavailableItems), 'Reports unavailable items array');
    assert(Array.isArray(reorderRes.data.summary.priceChanges), 'Reports price changes array');

    // Verify User A shopping bag contains reordered items
    const bagRes = await request('GET', '/api/bag', null, authHeadersA);
    assert(bagRes.status === 200, 'Fetched user bag after reorder');
    assert(bagRes.data.items && bagRes.data.items.length >= 1, 'Bag contains the reordered items');

    // User B attempting to reorder User A order gets 403
    const reorderUnauth = await request('POST', `/api/orders/${order1.id}/reorder`, null, authHeadersB);
    assert(reorderUnauth.status === 403, 'User B cannot reorder from User A\'s order (403)');

    // -------------------------------------------------------------
    // Test 9: Cancellation Eligibility & Idempotent Duplicate Prevention
    // -------------------------------------------------------------
    console.log('\n--- 9. Cancellation & Idempotency ---');
    const stockBeforeCancel = Product.findById('prod-1').stockCount;

    const cancelRes = await request(
      'POST',
      `/api/orders/${order1.id}/cancel`,
      { reason: 'Changed my mind / Better price found' },
      authHeadersA
    );
    assert(cancelRes.status === 200, 'Order cancelled successfully (200)');
    assert(cancelRes.data.order.status === 'Cancelled', 'Order status updated to Cancelled');
    assert(
      cancelRes.data.order.paymentStatus === 'Refund Pending' ||
        cancelRes.data.order.paymentStatus === 'Pending' ||
        cancelRes.data.order.paymentStatus === 'Cancelled',
      'Payment status safely handled on cancellation'
    );

    // Stock should be restored
    const stockAfterCancel = Product.findById('prod-1').stockCount;
    assert(
      stockAfterCancel === stockBeforeCancel + 2,
      `Inventory restored by 2 upon cancellation (from ${stockBeforeCancel} to ${stockAfterCancel})`
    );

    // Duplicate cancellation attempt
    const duplicateCancel = await request(
      'POST',
      `/api/orders/${order1.id}/cancel`,
      { reason: 'Trying to cancel again' },
      authHeadersA
    );
    assert(duplicateCancel.status === 400, 'Duplicate cancellation attempt rejected with 400 Bad Request');
    assert(duplicateCancel.data.error.includes('already cancelled'), 'Error explains order is already cancelled');

    // -------------------------------------------------------------
    // Test 10: Return / Exchange Eligibility
    // -------------------------------------------------------------
    console.log('\n--- 10. Return / Exchange Eligibility ---');
    // Cannot return a cancelled order
    const returnCancelled = await request(
      'POST',
      `/api/orders/${order1.id}/return`,
      { actionType: 'return', reason: 'Defective fabric' },
      authHeadersA
    );
    assert(returnCancelled.status === 400, 'Return rejected for non-delivered order (400)');

    // Create a new order and mark it Delivered
    const deliveredOrderRes = await request(
      'POST',
      '/api/orders',
      {
        items: [{ productId: 'prod-1', quantity: 1, size: 'M' }],
        paymentMethod: 'UPI / Razorpay',
        razorpay_order_id: 'ord_rzp_deliv',
        razorpay_payment_id: 'pay_rzp_deliv',
      },
      authHeadersA
    );
    const deliveredOrderId = deliveredOrderRes.data.order.id;

    // Mark as delivered
    await request('PATCH', `/api/orders/${deliveredOrderId}/status`, { status: 'Delivered' }, authHeadersA);

    // Submit return request
    const returnRes = await request(
      'POST',
      `/api/orders/${deliveredOrderId}/return`,
      { actionType: 'return', reason: 'Size too tight / Need larger size' },
      authHeadersA
    );
    assert(returnRes.status === 200, 'Return request accepted for Delivered order (200)');
    assert(returnRes.data.order.status === 'Returned', 'Status updated to Returned');
    assert(
      returnRes.data.order.paymentStatus === 'Refund Pending' ||
        returnRes.data.order.paymentStatus === 'Pending',
      'Refund status safely handled on return'
    );

    // Duplicate return attempt
    const duplicateReturn = await request(
      'POST',
      `/api/orders/${deliveredOrderId}/return`,
      { actionType: 'return', reason: 'Submitting duplicate return' },
      authHeadersA
    );
    assert(duplicateReturn.status === 400, 'Duplicate return request rejected (400)');

    // -------------------------------------------------------------
    // Test 11: Payment Security & Webhook Idempotency
    // -------------------------------------------------------------
    console.log('\n--- 11. Payment Security & Webhooks ---');
    const testEventId = `evt_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    // Webhook event processing
    const webhookRes1 = await request('POST', '/api/payment/webhook', {
      event: 'payment.captured',
      event_id: testEventId,
      payload: {
        payment: {
          entity: {
            id: 'pay_live_captured_1',
            order_id: deliveredOrderId,
            amount: 49900,
            status: 'captured',
          },
        },
      },
    });
    assert(webhookRes1.status === 200, 'Payment webhook processed successfully (200)');
    assert(webhookRes1.data.received === true, 'Webhook marked received');

    // Duplicate webhook delivery
    const webhookRes2 = await request('POST', '/api/payment/webhook', {
      event: 'payment.captured',
      event_id: testEventId,
      payload: {
        payment: {
          entity: {
            id: 'pay_live_captured_1',
            order_id: deliveredOrderId,
            amount: 49900,
            status: 'captured',
          },
        },
      },
    });
    assert(webhookRes2.status === 200, 'Duplicate webhook responded 200');
    assert(webhookRes2.data.duplicate === true, 'Duplicate webhook detected and ignored idempotently');

    // -------------------------------------------------------------
    // Test 12: Audit Trail Verification & Sanitization
    // -------------------------------------------------------------
    console.log('\n--- 12. Audit Trail & Security Sanitization ---');
    const auditRes = await request('GET', `/api/orders/${order1.id}/audit-trail`, null, authHeadersA);
    assert(auditRes.status === 200, 'GET audit trail responds 200');
    assert(auditRes.data.auditTrail.length >= 2, 'Audit trail contains multiple events (Created, Cancelled)');
    const eventTypes = auditRes.data.auditTrail.map((e) => e.eventType);
    assert(eventTypes.includes('ORDER_CREATED'), 'Audit trail records ORDER_CREATED');
    assert(eventTypes.includes('ORDER_CANCELLED'), 'Audit trail records ORDER_CANCELLED');

    // Check sanitization: verify no card numbers or CVVs exist in logs
    const allLogsJson = JSON.stringify(auditRes.data.auditTrail);
    assert(!allLogsJson.includes('cvv') && !allLogsJson.includes('cardNumber'), 'Audit trail contains no sensitive card data or CVVs');

    console.log('\n===============================================');
    console.log('🎉 ALL 12 TASK 4 ORDER & TRANSACTION TESTS PASSED!');
    console.log('===============================================\n');
  } finally {
    if (server) {
      server.close();
      console.log('Order test server closed.');
    }
  }
}

if (require.main === module) {
  runOrderTests().catch((err) => {
    console.error('Test run failed:', err);
    process.exit(1);
  });
}

module.exports = runOrderTests;
