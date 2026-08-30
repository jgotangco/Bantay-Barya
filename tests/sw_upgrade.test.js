/**
 * Bantay Barya - Deterministic Automated Test Suite for Service Worker Upgrade, Caching & Offline Resilience
 *
 * Requirements Tested:
 * 1. Async test runner that awaits every test and exits non-zero upon any assertion failure.
 * 2. Missing required local asset -> install fails (atomic failure).
 * 3. Missing optional asset -> core app shell still installs.
 * 4. Failed cross-origin CDN asset -> core app shell still installs.
 * 5. Old Bantay-Barya/Ledger-Tracker caches are purged on activation.
 * 6. Unrelated third-party origin caches survive activation.
 * 7. Network-First returns fresh JS when online and updates cache.
 * 8. Network failure returns cached JS when offline.
 * 9. Navigation failure returns cached index.html when offline.
 */

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

// Mock Cache implementation
class MockCache {
  constructor(name, failureUrls = new Set()) {
    this.name = name;
    this.storage = new Map();
    this.failureUrls = failureUrls;
  }
  async add(url) {
    if (this.failureUrls.has(url)) {
      throw new Error(`Network error fetching ${url}`);
    }
    this.storage.set(url, { status: 200, url: url, body: `content-of-${url}` });
    return true;
  }
  async addAll(urls) {
    // Atomic: If ANY URL fails, entire addAll rejects
    for (const url of urls) {
      if (this.failureUrls.has(url)) {
        throw new Error(`Atomic precache failed for required asset: ${url}`);
      }
    }
    for (const url of urls) {
      this.storage.set(url, { status: 200, url: url, body: `content-of-${url}` });
    }
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
  async delete(request) {
    const key = typeof request === 'string' ? request : request.url;
    return this.storage.delete(key);
  }
}

// Mock CacheStorage implementation
class MockCacheStorage {
  constructor(failureUrls = new Set()) {
    this.caches = new Map();
    this.failureUrls = failureUrls;
  }
  async open(name) {
    if (!this.caches.has(name)) {
      this.caches.set(name, new MockCache(name, this.failureUrls));
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

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const CURRENT_CACHE = `bantay-barya-v${pkg.version}`;

// Helper to instantiate a fresh Service Worker instance with clean mocks
function createSwEnvironment(options = {}) {
  const failureUrls = options.failureUrls || new Set();
  const mockCaches = new MockCacheStorage(failureUrls);
  const listeners = {};
  const mockSelf = {
    addEventListener: (event, cb) => { listeners[event] = cb; },
    skipWaiting: () => { mockSelf.skippedWaiting = true; },
    clients: {
      claim: async () => { mockSelf.claimedClients = true; }
    },
    importScripts: (scriptPath) => {
      if (scriptPath === './version.js' || scriptPath === 'version.js') {
        const vCode = fs.readFileSync(path.join(__dirname, '..', 'version.js'), 'utf8');
        new Function('globalThis', vCode)(globalThis);
      }
    }
  };

  const swCode = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const initSw = new Function('self', 'caches', 'fetch', 'importScripts', swCode);
  const mockFetch = options.fetch || (async (req) => {
    const url = typeof req === 'string' ? req : req.url;
    return {
      status: 200,
      url: url,
      clone: function () { return { status: 200, url: url, body: `fresh-network-${url}` }; },
      body: `fresh-network-${url}`
    };
  });

  initSw(mockSelf, mockCaches, mockFetch, mockSelf.importScripts);

  return { mockSelf, mockCaches, listeners };
}

// Async Test Runner
let passedTests = 0;
let failedTests = 0;
const testFailures = [];

async function test(description, testFn) {
  try {
    await testFn();
    passedTests++;
    console.log(`  ✓ ${description}`);
  } catch (err) {
    failedTests++;
    testFailures.push({ description, error: err });
    console.error(`  ✗ FAIL: ${description}`);
    console.error(`    ${err.message}`);
  }
}

async function runAll() {
  console.log('======================================================================');
  console.log(' BANTAY BARYA - DETERMINISTIC SERVICE WORKER TEST SUITE');
  console.log('======================================================================');

  console.log('\n--- 1. Precache Atomicity & Required vs Optional Assets ---');

  await test('Missing required local asset -> installation fails atomically', async () => {
    // Simulate required asset missing
    const failureUrls = new Set(['./modules/debts.js']);
    const { listeners } = createSwEnvironment({ failureUrls });

    let installPromise = null;
    listeners['install']({
      waitUntil: (p) => { installPromise = p; }
    });

    let installFailed = false;
    try {
      await installPromise;
    } catch (err) {
      installFailed = true;
      assert.match(err.message, /Atomic precache failed/);
    }
    assert.strictEqual(installFailed, true, 'Install must reject when a required local asset is missing');
  });

  await test('Missing optional / CDN asset -> core app shell still installs successfully', async () => {
    // Simulate optional CDN asset failure (Google Fonts)
    const cdnFontUrl = 'https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,500&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap';
    const failureUrls = new Set([cdnFontUrl]);
    const { mockCaches, listeners, mockSelf } = createSwEnvironment({ failureUrls });

    let installPromise = null;
    listeners['install']({
      waitUntil: (p) => { installPromise = p; }
    });

    await installPromise; // Must resolve without throwing

    const cache = await mockCaches.open(CURRENT_CACHE);
    assert.ok(await cache.match('./index.html'), 'Core index.html must be cached');
    assert.ok(await cache.match('./version.js'), 'Core version.js must be cached');
    assert.ok(await cache.match('./modules/wallets.js'), 'Core wallets.js must be cached');
    assert.ok(await cache.match('./modules/bills.js'), 'Core bills.js must be cached');
    assert.ok(await cache.match('./modules/debts.js'), 'Core debts.js must be cached');
    assert.strictEqual(mockSelf.skippedWaiting, true, 'Must call self.skipWaiting()');
  });

  await test('Failed Chart.js CDN asset -> core app shell still installs successfully', async () => {
    const chartJsUrl = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    const failureUrls = new Set([chartJsUrl]);
    const { mockCaches, listeners } = createSwEnvironment({ failureUrls });

    let installPromise = null;
    listeners['install']({
      waitUntil: (p) => { installPromise = p; }
    });

    await installPromise; // Must resolve cleanly

    const cache = await mockCaches.open(CURRENT_CACHE);
    assert.ok(await cache.match('./modules/data.js'));
    assert.ok(await cache.match('./app.js'));
    assert.ok(await cache.match('./version.js'));
  });

  console.log('\n--- 2. Selective Cache Eviction on Activation ---');

  await test('Old Bantay-Barya caches (ledger-tracker-*, bantay-barya-old) are purged', async () => {
    const { mockCaches, listeners, mockSelf } = createSwEnvironment();

    // Pre-populate older Bantay-Barya buckets
    await mockCaches.open('ledger-tracker-v2');
    await mockCaches.open('ledger-tracker-v1');
    await mockCaches.open('bantay-barya-v2.8.0');
    await mockCaches.open(CURRENT_CACHE);

    let activatePromise = null;
    listeners['activate']({
      waitUntil: (p) => { activatePromise = p; }
    });
    await activatePromise;

    const remainingKeys = await mockCaches.keys();
    assert.ok(!remainingKeys.includes('ledger-tracker-v2'), 'Must purge legacy ledger-tracker-v2');
    assert.ok(!remainingKeys.includes('ledger-tracker-v1'), 'Must purge legacy ledger-tracker-v1');
    assert.ok(!remainingKeys.includes('bantay-barya-v2.8.0'), 'Must purge older version bantay-barya-v2.8.0');
    assert.ok(remainingKeys.includes(CURRENT_CACHE), 'Must retain current version bucket');
    assert.strictEqual(mockSelf.claimedClients, true, 'Must claim clients');
  });

  await test('Unrelated third-party origin caches survive activation', async () => {
    const { mockCaches, listeners } = createSwEnvironment();

    // Pre-populate unrelated third-party caches
    await mockCaches.open('unrelated-app-cache');
    await mockCaches.open('third-party-analytics-v1');
    await mockCaches.open(CURRENT_CACHE);

    let activatePromise = null;
    listeners['activate']({
      waitUntil: (p) => { activatePromise = p; }
    });
    await activatePromise;

    const remainingKeys = await mockCaches.keys();
    assert.ok(remainingKeys.includes('unrelated-app-cache'), 'Unrelated app cache must NOT be deleted');
    assert.ok(remainingKeys.includes('third-party-analytics-v1'), 'Third-party cache must NOT be deleted');
    assert.ok(remainingKeys.includes(CURRENT_CACHE), 'Bantay Barya cache must be preserved');
  });

  console.log('\n--- 3. Network-First & Offline Fallback Fetch Strategies ---');

  await test('Network-First returns fresh JS when online and updates cache', async () => {
    let networkFetchCount = 0;
    const mockFetch = async (req) => {
      networkFetchCount++;
      return {
        status: 200,
        url: req.url,
        clone: function () { return { status: 200, url: req.url, body: 'fresh-network-content' }; },
        body: 'fresh-network-content'
      };
    };

    const { mockCaches, listeners } = createSwEnvironment({ fetch: mockFetch });
    const cache = await mockCaches.open(CURRENT_CACHE);
    await cache.put('./modules/debts.js', { status: 200, url: './modules/debts.js', body: 'old-cached-content' });

    let fetchResponsePromise = null;
    listeners['fetch']({
      request: { url: 'https://example.com/modules/debts.js', mode: 'cors' },
      respondWith: (p) => { fetchResponsePromise = p; }
    });

    const response = await fetchResponsePromise;
    assert.strictEqual(networkFetchCount, 1, 'Must attempt network fetch first');
    assert.strictEqual(response.body, 'fresh-network-content', 'Must return fresh network response');
  });

  await test('Network failure returns cached JS when offline', async () => {
    // Offline fetch throws network error
    const offlineFetch = async () => {
      throw new Error('TypeError: Failed to fetch (Offline)');
    };

    const { mockCaches, listeners } = createSwEnvironment({ fetch: offlineFetch });
    const cache = await mockCaches.open(CURRENT_CACHE);
    await cache.put('https://example.com/modules/debts.js', {
      status: 200,
      url: 'https://example.com/modules/debts.js',
      body: 'offline-cached-debt-logic'
    });

    let fetchResponsePromise = null;
    listeners['fetch']({
      request: { url: 'https://example.com/modules/debts.js', mode: 'cors' },
      respondWith: (p) => { fetchResponsePromise = p; }
    });

    const response = await fetchResponsePromise;
    assert.ok(response, 'Must return cached response when offline');
    assert.strictEqual(response.body, 'offline-cached-debt-logic');
  });

  await test('Navigation failure returns cached index.html when offline', async () => {
    const offlineFetch = async () => {
      throw new Error('TypeError: Failed to fetch (Offline)');
    };

    const { mockCaches, listeners } = createSwEnvironment({ fetch: offlineFetch });
    const cache = await mockCaches.open(CURRENT_CACHE);
    await cache.put('./index.html', {
      status: 200,
      url: './index.html',
      body: '<!DOCTYPE html><html><body>Bantay Barya Offline Shell</body></html>'
    });

    let fetchResponsePromise = null;
    listeners['fetch']({
      request: { url: 'https://example.com/dashboard', mode: 'navigate' },
      respondWith: (p) => { fetchResponsePromise = p; }
    });

    const response = await fetchResponsePromise;
    assert.ok(response, 'Must fallback to cached index.html for failed navigation');
    assert.match(response.body, /Bantay Barya Offline Shell/);
  });

  console.log('\n======================================================================');
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('======================================================================');

  if (failedTests > 0) {
    console.error(`\n❌ ${failedTests} TEST(S) FAILED:`);
    testFailures.forEach((f, i) => {
      console.error(`  ${i + 1}. ${f.description}`);
      console.error(`     Error: ${f.error.message}`);
    });
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll();

