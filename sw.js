/**
 * Bantay Barya - Progressive Web App (PWA) Service Worker
 * Strategy:
 *  - Core App Logic (HTML, JS modules, CSS): Network-First with Cache Fallback for instant updates & full offline access.
 *  - Static CDN Assets (Fonts, Chart.js, Icons, PDF): Cache-First / Stale-While-Revalidate.
 *  - Live FX APIs: Network-First with cached rate fallback.
 *  - Automatic Cache Upgrades & Old Cache Eviction.
 */

// Load canonical application version generated from package.json
try {
  importScripts('./version.js');
} catch (e) {
  // In environments where importScripts is not available or fails,
  // version metadata must already be present in globalThis.
}

const APP_VERSION = typeof globalThis !== 'undefined' ? globalThis.BANTAY_BARYA_VERSION : null;

if (!APP_VERSION) {
  throw new Error('Bantay Barya version metadata is unavailable. Regenerate version.js.');
}

const CACHE_NAME = `bantay-barya-v${APP_VERSION}`;

// 1. Required Local App Shell (Atomic precache: installation MUST fail if any of these are missing)
const REQUIRED_LOCAL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './version.js',
  './app.js',
  './modules/data.js',
  './modules/storage.js',
  './modules/crypto.js',
  './modules/validator.js',
  './modules/currency.js',
  './modules/theme.js',
  './modules/wallets.js',
  './modules/debts.js',
  './modules/bills.js',
  './modules/reports.js',
  './manifest.json',
  './icons/icon.svg'
];

// 2. Optional / External Cross-Origin Assets (Cached non-atomically: failure does NOT break installation)
const OPTIONAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,500&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Required local assets must all succeed atomically
      await cache.addAll(REQUIRED_LOCAL_ASSETS);

      // Optional and cross-origin CDN assets are cached individually without failing installation
      await Promise.all(
        OPTIONAL_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`Optional asset failed to pre-cache (${url}):`, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // Restrict eviction to Bantay-Barya owned caches
          const isBantayBaryaCache = key.startsWith('bantay-barya-') || key.startsWith('ledger-tracker-');
          if (isBantayBaryaCache && key !== CACHE_NAME) {
            console.log('Purging legacy Bantay-Barya cache bucket:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // 1. Currency APIs -> Network-first with cache fallback
  if (url.includes('api.frankfurter.app') ||
      url.includes('open.er-api.com') ||
      url.includes('currency-api')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. Application Logic & Navigation -> Network-First (with Cache Fallback for offline)
  // Guarantees updated financial calculations reach users immediately when online
  if (event.request.mode === 'navigate' ||
      url.endsWith('.html') ||
      url.endsWith('.js') ||
      url.endsWith('.css') ||
      url.includes('/modules/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            if (event.request.mode === 'navigate') return caches.match('./index.html');
            return null;
          });
        })
    );
    return;
  }

  // 3. Static CDN & Media Assets (Fonts, Chart.js, Icons, PDF) -> Cache-First with Network Fetch Fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return networkResponse;
      });
    })
  );
});
