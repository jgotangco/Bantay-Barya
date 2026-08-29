/**
 * Bantay Barya - Deterministic Automated Test Suite for Canonical Version Synchronization & Release Safety
 *
 * Requirements Tested:
 * 1. package.json contains a valid canonical semver version string.
 * 2. version.js exists on disk and defines globalThis.BANTAY_BARYA_VERSION.
 * 3. The value in version.js strictly equals package.json.version.
 * 4. sw.js derives CACHE_NAME dynamically from the canonical version rather than hard-coding a static version string.
 * 5. sw.js contains NO literal current app version string used as a fallback (no || '2.9.0').
 * 6. Missing version metadata causes sw.js to throw an explicit error on startup rather than silently falling back.
 * 7. The computed CACHE_NAME matches `bantay-barya-v${package.json.version}`.
 * 8. Production source files do not contain conflicting hard-coded CURRENT version constants.
 * 9. Release-Safety Test: Demonstrates with test fixtures that bumping package version to X+1 updates CACHE_NAME to bantay-barya-vX+1 without editing sw.js.
 * 10. Deterministic Output: Running syncVersion repeatedly yields identical file content.
 */

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { syncVersion } = require('../scripts/sync-version');

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

console.log('======================================================================');
console.log(' BANTAY BARYA - CANONICAL VERSION & RELEASE-SAFETY TEST SUITE');
console.log('======================================================================');

console.log('\n--- 1. Canonical Version Source of Truth ---');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const versionJsPath = path.join(__dirname, '..', 'version.js');
const swJsPath = path.join(__dirname, '..', 'sw.js');

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

test('package.json.version exists and is a valid semantic version string', () => {
  assert.ok(pkg.version, 'package.json must have a "version" property');
  assert.strictEqual(typeof pkg.version, 'string', 'version must be a string');
  assert.match(pkg.version.trim(), /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/, 'version must match semver pattern');
});

test('version.js exists on disk', () => {
  assert.ok(fs.existsSync(versionJsPath), 'version.js must exist in root directory');
});

test('version.js defines BANTAY_BARYA_VERSION exactly matching package.json.version', () => {
  const versionJsContent = fs.readFileSync(versionJsPath, 'utf8');
  assert.match(versionJsContent, /globalThis\.BANTAY_BARYA_VERSION\s*=\s*['"][^'"]+['"];/);

  // Execute version.js in a dedicated sandbox context
  const sandbox = {};
  const runVersionJs = new Function('globalThis', versionJsContent);
  runVersionJs(sandbox);

  assert.strictEqual(
    sandbox.BANTAY_BARYA_VERSION,
    pkg.version,
    `version.js (${sandbox.BANTAY_BARYA_VERSION}) must match package.json (${pkg.version})`
  );
});

console.log('\n--- 2. Service Worker Dynamic Derivation & Strict Fallback Elimination ---');

test('sw.js derives CACHE_NAME dynamically from globalThis.BANTAY_BARYA_VERSION', () => {
  const swContent = fs.readFileSync(swJsPath, 'utf8');

  // Verify that sw.js does not contain a hard-coded static CACHE_NAME string
  assert.ok(
    !swContent.includes("const CACHE_NAME = 'bantay-barya-v2.9.0'"),
    "sw.js must NOT contain hard-coded 'bantay-barya-v2.9.0'"
  );

  assert.ok(
    swContent.includes('globalThis.BANTAY_BARYA_VERSION') || swContent.includes('APP_VERSION'),
    'sw.js must reference BANTAY_BARYA_VERSION or derived APP_VERSION'
  );
});

test('sw.js contains no literal current app version string used as a fallback', () => {
  const swContent = fs.readFileSync(swJsPath, 'utf8');

  // Ensure no literal current app version is present in sw.js
  assert.ok(
    !swContent.includes(`'${pkg.version}'`) && !swContent.includes(`"${pkg.version}"`),
    `sw.js must NOT contain literal current version '${pkg.version}' as a fallback or constant`
  );

  assert.ok(
    !swContent.includes("|| '2.9.0'") && !swContent.includes('|| "2.9.0"'),
    "sw.js must NOT contain hardcoded fallback '2.9.0'"
  );
});

test('Missing version metadata causes sw.js to throw an explicit Error on startup', () => {
  const swContent = fs.readFileSync(swJsPath, 'utf8');
  const mockSelf = {
    addEventListener: () => {},
    skipWaiting: () => {},
    clients: { claim: async () => {} }
  };
  const mockImportScriptsNoOp = () => {};
  const initSw = new Function('self', 'caches', 'fetch', 'importScripts', 'globalThis', swContent);

  assert.throws(
    () => {
      initSw(mockSelf, {}, async () => {}, mockImportScriptsNoOp, {});
    },
    /Bantay Barya version metadata is unavailable/
  );
});

test('Executing sw.js produces exact CACHE_NAME `bantay-barya-v<package.json.version>`', () => {
  const swContent = fs.readFileSync(swJsPath, 'utf8');

  // Set up mock Service Worker sandbox
  const listeners = {};
  const mockSelf = {
    addEventListener: (evt, cb) => { listeners[evt] = cb; },
    skipWaiting: () => {},
    clients: { claim: async () => {} }
  };
  const mockCaches = { open: async () => {}, keys: async () => [] };
  const mockFetch = async () => {};

  // Mock importScripts to execute version.js
  const mockImportScripts = (scriptPath) => {
    if (scriptPath === './version.js' || scriptPath === 'version.js') {
      const vCode = fs.readFileSync(versionJsPath, 'utf8');
      new Function('globalThis', vCode)(globalThis);
    }
  };

  // Run sw.js
  const initSw = new Function('self', 'caches', 'fetch', 'importScripts', swContent + '; return CACHE_NAME;');
  const computedCacheName = initSw(mockSelf, mockCaches, mockFetch, mockImportScripts);

  assert.strictEqual(
    computedCacheName,
    `bantay-barya-v${pkg.version}`,
    `Derived CACHE_NAME must be 'bantay-barya-v${pkg.version}', got '${computedCacheName}'`
  );
});

console.log('\n--- 3. Production Code Cleanliness (No Conflicting Current Version Strings) ---');

test('Production JavaScript files do not contain competing CURRENT version constants', () => {
  const prodFiles = [
    path.join(__dirname, '..', 'sw.js'),
    path.join(__dirname, '..', 'app.js'),
    path.join(__dirname, '..', 'modules', 'data.js'),
    path.join(__dirname, '..', 'modules', 'theme.js'),
    path.join(__dirname, '..', 'modules', 'wallets.js'),
    path.join(__dirname, '..', 'modules', 'debts.js'),
    path.join(__dirname, '..', 'modules', 'bills.js'),
    path.join(__dirname, '..', 'modules', 'reports.js')
  ];

  prodFiles.forEach((filePath) => {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, lineIdx) => {
      // Allow comments or legitimate data format versions (e.g. fileVersion: '7.0')
      if (line.includes('fileVersion:') || line.includes('version: \'7.0\'')) return;

      // Check if any line attempts to define a competing hard-coded APP_VERSION or CACHE_NAME constant
      if (/const\s+APP_VERSION\s*=\s*['"]\d+\.\d+\.\d+['"]/.test(line) && !line.includes('globalThis.BANTAY_BARYA_VERSION')) {
        assert.fail(`Found hard-coded APP_VERSION in ${path.basename(filePath)}:${lineIdx + 1}`);
      }
    });
  });
});

console.log('\n--- 4. Release-Safety & Version Bump Simulation ---');

test('Release-Safety: Bumping version in package fixture dynamically updates version.js and sw CACHE_NAME to X+1', () => {
  const tmpDir = path.join(__dirname, '..', 'scratch');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const fixturePackageJsonPath = path.join(tmpDir, 'fixture-package.json');
  const fixtureVersionJsPath = path.join(tmpDir, 'fixture-version.js');

  // Given: simulated package.json with bumped version '3.0.0'
  const futureVersion = '3.0.0';
  fs.writeFileSync(fixturePackageJsonPath, JSON.stringify({ name: 'bantay-barya', version: futureVersion }, null, 2), 'utf8');

  // When: syncVersion is executed for the fixture
  const generatedVersion = syncVersion({
    packageJsonPath: fixturePackageJsonPath,
    targetFilePath: fixtureVersionJsPath,
    silent: true
  });

  assert.strictEqual(generatedVersion, futureVersion);
  assert.ok(fs.existsSync(fixtureVersionJsPath));

  const fixtureVersionJsContent = fs.readFileSync(fixtureVersionJsPath, 'utf8');
  assert.ok(fixtureVersionJsContent.includes(`globalThis.BANTAY_BARYA_VERSION = '${futureVersion}';`));

  const swContent = fs.readFileSync(swJsPath, 'utf8');
  const mockImportScripts = (scriptPath) => {
    const vCode = fs.readFileSync(fixtureVersionJsPath, 'utf8');
    new Function('globalThis', vCode)(globalThis);
  };
  const mockSelf = {
    addEventListener: () => {},
    skipWaiting: () => {},
    clients: { claim: async () => {} }
  };
  const initSw = new Function('self', 'caches', 'fetch', 'importScripts', swContent + '; return CACHE_NAME;');
  const bumpedCacheName = initSw(mockSelf, {}, async () => {}, mockImportScripts);

  assert.strictEqual(
    bumpedCacheName,
    `bantay-barya-v${futureVersion}`,
    'Service Worker must seamlessly adopt bantay-barya-v3.0.0 without manual edits to sw.js'
  );

  // Clean up fixture files
  try {
    fs.unlinkSync(fixturePackageJsonPath);
    fs.unlinkSync(fixtureVersionJsPath);
  } catch (e) {}
});

test('Deterministic Output: Repeated syncVersion runs produce bit-for-bit identical version.js', () => {
  const firstPass = syncVersion({ silent: true });
  const firstContent = fs.readFileSync(versionJsPath, 'utf8');

  const secondPass = syncVersion({ silent: true });
  const secondContent = fs.readFileSync(versionJsPath, 'utf8');

  assert.strictEqual(firstPass, secondPass);
  assert.strictEqual(firstContent, secondContent, 'Generated version.js must be bit-for-bit deterministic');
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
