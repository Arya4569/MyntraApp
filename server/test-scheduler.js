/**
 * Automated Test Suite for Task 3:
 * Real-Time Push Notification System & Abandoned-Cart Scheduler
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const schedulerService = require('./src/services/schedulerService');
const NotificationService = require('./src/services/notificationService');
const DeviceToken = require('./src/models/DeviceToken');
const NotificationPreference = require('./src/models/NotificationPreference');
const Notification = require('./src/models/Notification');
const db = require('./src/db');

async function runTests() {
  console.log('=== Task 3: Abandoned-Cart Scheduler & Notification Tests ===\n');
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

  // Setup test user with cart items
  const testUserId = 'test_scheduler_user_' + Date.now();
  const dbData = db.read();
  dbData.bags = dbData.bags || {};
  dbData.bags[testUserId] = [
    {
      id: 'cart_item_1',
      productId: 'prod-1',
      size: 'M',
      quantity: 1,
      addedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    },
  ];
  db.write(dbData);

  // 1. Initialize scheduler
  test('Scheduler initializes and loads cron jobs', () => {
    const status = schedulerService.init();
    assert.strictEqual(status.initialized, true, 'Scheduler should be initialized');
    assert(status.jobsCount >= 1, 'Should have at least 1 job scheduled');
    const job = status.jobs.find((j) => j.name === 'abandoned_carts');
    assert(job, 'Should contain abandoned_carts job');
    assert.strictEqual(job.enabled, true, 'abandoned_carts should be enabled');
  });

  // 2. Execute abandoned carts job
  await asyncTest('Scheduler runs abandoned_carts job and detects cart items', async () => {
    const result = await schedulerService.runJob('abandoned_carts');
    assert(result.success, 'Job should succeed');
    assert(result.result, 'Job should return execution result');
    assert(typeof result.result.remindedCount === 'number', 'Should return reminded count');
  });

  // 3. Deduplication check: Second run within same day must not send duplicate reminder
  await asyncTest('Scheduler deduplication prevents sending duplicate reminder on same day', async () => {
    const result = await schedulerService.runJob('abandoned_carts');
    assert(result.success, 'Second run should succeed cleanly');
    // The test user should NOT be reminded again because idempotencyKey was recorded
    assert(!result.result.users.includes(testUserId), 'Test user should not be reminded twice in same day');
  });

  // 4. Lock guard prevents concurrent duplicate execution
  await asyncTest('Job lock prevents duplicate concurrent execution', async () => {
    schedulerService.jobLocks.set('abandoned_carts', true);
    const result = await schedulerService.runJob('abandoned_carts');
    assert.strictEqual(result.skipped, true, 'Concurrent execution should be skipped');
    assert.strictEqual(result.reason, 'Job currently in progress (locked)');
    schedulerService.jobLocks.set('abandoned_carts', false);
  });

  // 5. State persistence survives across reloads
  test('Scheduler state is persisted to disk and reloadable', () => {
    const statusBefore = schedulerService.getStatus();
    const jobBefore = statusBefore.jobs.find((j) => j.name === 'abandoned_carts');
    assert(jobBefore.executionCount >= 1, 'Execution count should be >= 1');
    assert(jobBefore.lastRun, 'lastRun should be set');

    // Reload state from disk
    const reloadedState = schedulerService.loadState();
    assert(reloadedState.abandoned_carts, 'Reloaded state should contain abandoned_carts');
    assert.strictEqual(
      reloadedState.abandoned_carts.executionCount,
      jobBefore.executionCount,
      'Persisted execution count should match'
    );
  });

  // 6. User preference respect: if user disables 'cart' notifications, reminder is suppressed
  await asyncTest('Notification preference suppresses reminder if user disabled cart category', async () => {
    const userPrefId = 'test_pref_user_' + Date.now();
    
    // Add cart item first
    const currentDb = db.read();
    currentDb.bags = currentDb.bags || {};
    currentDb.bags[userPrefId] = [
      {
        id: 'cart_item_pref',
        productId: 'prod-2',
        size: 'L',
        quantity: 1,
      },
    ];
    db.write(currentDb);

    // Then update preference
    NotificationPreference.update(userPrefId, {
      cartReminders: false,
    });

    const res = await NotificationService.checkAbandonedCarts(userPrefId);
    assert.strictEqual(res.remindedCount, 0, 'User with cart notifications disabled should not be reminded');
    assert(!res.users.includes(userPrefId), 'User should not be in reminded users list');

    // cleanup
    const cleanDb = db.read();
    delete cleanDb.bags[userPrefId];
    if (cleanDb.notificationPreferences) {
      delete cleanDb.notificationPreferences[userPrefId];
    }
    db.write(cleanDb);
  });

  // Cleanup
  schedulerService.stop();
  const finalDb = db.read();
  delete finalDb.bags[testUserId];
  // Also clean up any lingering test users in bags
  Object.keys(finalDb.bags || {}).forEach((k) => {
    if (k.startsWith('test_')) delete finalDb.bags[k];
  });
  db.write(finalDb);

  console.log(`\nScheduler Test Results: ${passed}/${total} passed`);
  if (passed === total) {
    console.log('🎉 ALL SCHEDULER & NOTIFICATION TESTS PASSED!\n');
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
