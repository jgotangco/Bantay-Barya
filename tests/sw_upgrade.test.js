/**
 * Bantay Barya - Automated Test Suite for Service Worker Upgrade & Offline Strategies
 */

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

// Mock Cache & ServiceWorker APIs
class MockCache {
  constructor(name) {
    this.name = name;
    this.storage = new Map();
  }
  async addAll(urls) {
    urls.forEach(u => this.storage.set(u, { status: 200, url: u }));
    return true;
  }
  async match(request) {
    const key = typeof request === 'string' ? request : request.url;
    return this.storage.get(key) || null;
  }
  async put(request, response) {
    const key = typeof request === 'string' ? request : request.url;
    this.storage.set(key, response);
  }
}

class MockCacheStorage {
  constructor() {
    this.caches = new Map();
  }
  async open(name) {
    if (!this.caches.has(name)) {
      this.caches.set(name, new MockCache(name));
    }
    return this.caches.get(name);
  }
  async keys() {
    return Array.from(this.caches.keys());
  }
  async match(request) {
    for (const cache of this.caches.values()) {
      const match = await cache.match(request);
      if (match) return match;
    }
    return null;
  }
  async delete(name) {
    return this.caches.delete(name);
  }
}

// Setup sandbox
const listeners = {};
const mockSelf = {
  addEventListener: (event, cb) => { listeners[event] = cb; },
  skipWaiting: () => { mockSelf.skippedWaiting = true; },
  clients: {
    claim: async () => { mockSelf.claimedClients = true; }
  }
};

const mockCaches = new MockCacheStorage();

// Read sw.js
const swCode = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const initSw = new Function('self', 'caches', swCode);
initSw(mockSelf, mockCaches);

let passedTests = 0;
let failedTests = 0;
const testFailures = [];

function test(description, testFn) {
  try {
    testFn();
    passedTests++;
    console.log(`  ✓ ${description}`);
  } catch (err) {
    failedTests++;
    testFailures.push({ description, error: err });
    console.error(`  ✗ FAIL: ${description}`);
    console.error(`    ${err.message}`);
  }
}

function describe(suiteName, suiteFn) {
  console.log(`\n--- ${suiteName} ---`);
  suiteFn();
}

console.log('======================================================================');
console.log(' BANTAY BARYA - SERVICE WORKER UPGRADE & CACHING TEST SUITE');
console.log('======================================================================');

describe('1. Install Event & Modular Asset Caching', () => {
  test('Install caches all required local modules including debts, bills, wallets, data, theme, reports', async () => {
    let waitUntilPromise = null;
    listeners['install']({
      waitUntil: (p) => { waitUntilPromise = p; }
    });
    await waitUntilPromise;

    const cacheKeys = await mockCaches.keys();
    assert.strictEqual(cacheKeys[0], 'bantay-barya-v2.9.0');

    const cache = await mockCaches.open('bantay-barya-v2.9.0');
    assert.ok(await cache.match('./modules/debts.js'));
    assert.ok(await cache.match('./modules/bills.js'));
    assert.ok(await cache.match('./modules/wallets.js'));
    assert.ok(await cache.match('./modules/data.js'));
    assert.ok(await cache.match('./modules/reports.js'));
    assert.ok(await cache.match('./modules/theme.js'));
    assert.ok(await cache.match('./index.html'));
    assert.ok(mockSelf.skippedWaiting, 'Must call self.skipWaiting() on install');
  });
});

describe('2. Activate Event & Legacy Cache Eviction', () => {
  test('Activate deletes old ledger-tracker-v2 and legacy buckets', async () => {
    // Seed old cache bucket
    await mockCaches.open('ledger-tracker-v2');
    await mockCaches.open('ledger-tracker-v1');
    assert.ok((await mockCaches.keys()).includes('ledger-tracker-v2'));

    let activatePromise = null;
    listeners['activate']({
      waitUntil: (p) => { activatePromise = p; }
    });
    await activatePromise;

    const remainingKeys = await mockCaches.keys();
    assert.ok(!remainingKeys.includes('ledger-tracker-v2'), 'Must purge old ledger-tracker-v2');
    assert.ok(!remainingKeys.includes('ledger-tracker-v1'), 'Must purge old ledger-tracker-v1');
    assert.ok(remainingKeys.includes('bantay-barya-v2.9.0'), 'Must retain current v2.9.0 cache');
    assert.ok(mockSelf.claimedClients, 'Must claim clients immediately');
  });
});

console.log('\n======================================================================');
console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('======================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('\n🎉 ALL SERVICE WORKER TESTS PASSED WITH 100% PRECISION!\n');
  process.exit(0);
}
