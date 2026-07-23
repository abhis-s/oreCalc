// OreCalc Service Worker
// Built with Workbox injectManifest mode.
//
// On every fresh install, we probe AVIF support using one of our own assets.
// Only the browser-supported format (AVIF or WebP) is precached; the other is
// filtered out before a single byte is stored — so cache storage is never
// wasted on images the browser cannot use.

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');

workbox.setConfig({ debug: false });

const { PrecacheController, cleanupOutdatedCaches } = workbox.precaching;
const { registerRoute }                              = workbox.routing;
const { NetworkFirst, StaleWhileRevalidate, CacheFirst } = workbox.strategies;
const { CacheableResponsePlugin }                    = workbox.cacheableResponse;
const { ExpirationPlugin }                           = workbox.expiration;

// Clean up old caches from previous versions of Workbox
cleanupOutdatedCaches();

// ─── AVIF format probe ────────────────────────────────────────────────────────

/**
 * Probes the browser's capability to parse and decode AVIF images inside the Service Worker thread.
 * Since the DOM/HTMLImageElement is not available in Web Workers, this function uses fetch to request
 * a small, valid AVIF asset, converts it to a blob, and tries to decode it using `createImageBitmap()`.
 * If `createImageBitmap` succeeds, the browser supports AVIF; if it fails or throw an error, we assume no support.
 *
 * @returns {Promise<boolean>} True if AVIF decoding is supported, false otherwise.
 */
async function detectAvifSupport() {
    if (typeof createImageBitmap === 'undefined') return false;
    try {
        const res = await fetch('/assets/resources/gem-100.avif', { cache: 'no-store' });
        if (!res.ok) return false;
        await createImageBitmap(await res.blob());
        return true;
    } catch {
        return false;
    }
}

// ─── Precache controller ──────────────────────────────────────────────────────
// The manifest below is injected by workbox-cli at build time. It lists both
// .avif and .webp for every image; we filter in the install event so only the
// browser-supported format is ever stored in cache.
const precacheController = new PrecacheController();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

// The 'install' handler checks for AVIF capability. Depending on the capability,
// it filters either all `.avif` or all `.webp` files from the Workbox precache manifest
// to save storage space and bandwidth.
self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const avifSupported = await detectAvifSupport();
        const discardExt    = avifSupported ? '.webp' : '.avif';

        const filteredManifest = (self.__WB_MANIFEST || []).filter(entry => {
            const url = typeof entry === 'string' ? entry : entry.url;
            return !url.endsWith(discardExt);
        });

        precacheController.addToCacheList(filteredManifest);
        await precacheController.install(event);
        self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        await precacheController.activate(event);
        await self.clients.claim();
    })());
});

// Allows Workbox Window to trigger SW updates from the UI.
self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ─── Fetch: precache → runtime routing ───────────────────────────────────────
// Precached assets are served cache-first. Requests not in the precache fall
// through (no respondWith call) so Workbox's router picks them up below.
self.addEventListener('fetch', event => {
    const cacheKey = precacheController.getCacheKeyForURL(event.request.url);
    if (cacheKey) {
        event.respondWith(
            precacheController.strategy.handle({ event, request: event.request })
        );
        return;
    }
    // No respondWith → Workbox routing handles this request.
});

// ─── Runtime routes ───────────────────────────────────────────────────────────
registerRoute(
    /^https:\/\/api\.orecalc\.tech\//,
    new NetworkFirst({
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
        plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
    })
);

const navigationStrategy = new NetworkFirst({
    cacheName: 'navigation-cache',
    plugins: [new CacheableResponsePlugin({ statuses: [200] })]
});

registerRoute(
    ({ request, url }) => request.mode === 'navigate' && !url.pathname.includes('/api/'),
    async (options) => {
        try {
            const response = await navigationStrategy.handle(options);
            if (response) return response;
        } catch (error) {
            // Network failed or offline
        }

        const pathname = options.url.pathname;
        const segments = pathname.split('/').filter(Boolean);
        let lang = 'en';
        if (segments.length > 0 && ['en', 'de', 'tr'].includes(segments[0].toLowerCase())) {
            lang = segments[0].toLowerCase();
        }

        const localizedKey = precacheController.getCacheKeyForURL(`/${lang}/index.html`) 
                          || precacheController.getCacheKeyForURL('/index.html');

        if (localizedKey) {
            const cache = await caches.open(workbox.core.cacheNames.precache);
            const cachedResponse = await cache.match(localizedKey);
            if (cachedResponse) return cachedResponse;
        }

        return Response.error();
    }
);

// Cache Clash of Clans API assets (like league icons)
registerRoute(
    /^https:\/\/api-assets\.clashofclans\.com\//,
    new CacheFirst({
        cacheName: 'clash-assets-cache',
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
            }),
        ],
    })
);
