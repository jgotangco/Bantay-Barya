/**
 * Bantay Barya - Version Synchronization Generator
 * Reads canonical version from package.json and generates version.js for browser and Service Worker environments.
 */

const fs = require('fs');
const path = require('path');

function syncVersion(options = {}) {
  const packageJsonPath = options.packageJsonPath || path.join(__dirname, '..', 'package.json');
  const targetFilePath = options.targetFilePath || path.join(__dirname, '..', 'version.js');
  const silent = options.silent || false;

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`[sync-version] Error: package.json not found at ${packageJsonPath}`);
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = pkg.version;

  if (!version || typeof version !== 'string' || !version.trim()) {
    throw new Error('[sync-version] Error: "version" in package.json is missing or empty.');
  }

  const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
  if (!semverRegex.test(version.trim())) {
    throw new Error(`[sync-version] Error: Invalid semver version "${version}" in package.json.`);
  }

  const cleanVersion = version.trim();
  const fileContent = `// AUTO-GENERATED FROM package.json — DO NOT EDIT MANUALLY.
// Run "npm run sync-version" to regenerate after updating package.json version.
globalThis.BANTAY_BARYA_VERSION = '${cleanVersion}';
`;

  fs.writeFileSync(targetFilePath, fileContent, 'utf8');

  if (!silent) {
    console.log(`[sync-version] Synchronized version.js -> ${cleanVersion}`);
  }

  return cleanVersion;
}

if (require.main === module) {
  try {
    syncVersion();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { syncVersion };
