// OreCalc Service Worker
// Built with Workbox injectManifest mode.
//
// On every fresh install, we probe AVIF support using one of our own assets.
// Only the browser-supported format (AVIF or WebP) is precached; the other is
// filtered out before a single byte is stored — so cache storage is never
// wasted on images the browser cannot use.

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');

workbox.setConfig({ debug: false });

workbox.core.setCacheNameDetails({
    prefix: 'orecalc',
    suffix: 'v2.3.0',
    precache: 'precache'
});

const { PrecacheController, cleanupOutdatedCaches } = workbox.precaching;
const { registerRoute }                              = workbox.routing;
const { NetworkFirst, CacheFirst }                    = workbox.strategies;
const { CacheableResponsePlugin }                    = workbox.cacheableResponse;
const { ExpirationPlugin }                           = workbox.expiration;

// Clean up old caches from previous versions of Workbox
cleanupOutdatedCaches();

// AVIF format probe

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

// Precache controller
// The manifest below is injected by workbox-cli at build time and registered
// synchronously at top level so every SW wake-up (online or offline) populates
// cache key lookups even when the 'install' event does not re-run.
const precacheController = new PrecacheController();
const fullManifest = self.__WB_MANIFEST || [];
precacheController.addToCacheList(fullManifest);

// Lifecycle

// The 'install' handler checks for AVIF capability and downloads only the
// supported image format (.avif or .webp) into precache storage.
self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const avifSupported = await detectAvifSupport();
        const discardExt    = avifSupported ? '.webp' : '.avif';

        const filteredManifest = fullManifest.filter(entry => {
            const url = typeof entry === 'string' ? entry : entry.url;
            // Animated and static emote assets are published exclusively as WebP (no AVIF variant)
            if (url.includes('assets/avatars/emotes/') && url.endsWith('.webp')) {
                return true;
            }
            return !url.endsWith(discardExt);
        });

        const installController = new PrecacheController();
        installController.addToCacheList(filteredManifest);
        await installController.install(event);
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        try {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName.includes('workbox-precache') && cacheName !== precacheController.strategy.cacheName) {
                        return caches.delete(cacheName);
                    }
                })
            );
        } catch (e) {}
        await precacheController.activate(event);
        await self.clients.claim();
    })());
});

// Allows Workbox Window or PWA Service to trigger SW updates cleanly from the UI or on visibilitychange.
self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING' || event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Fetch: precache to runtime routing
// Precached assets are served cache-first. Requests not in the precache fall
// through (no respondWith call) so Workbox's router picks them up below.
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Bypass Service Worker completely for decoupled legal/policy and 404 pages
    if (
        url.pathname.includes('/privacy') ||
        url.pathname.includes('/terms') ||
        url.pathname.includes('/licenses') ||
        url.pathname.includes('/legal') ||
        url.pathname.includes('/404')
    ) {
        return;
    }

    let cacheKey = precacheController.getCacheKeyForURL(event.request.url);
    let targetUrl = event.request.url;
    if (!cacheKey && url.search) {
        const cleanUrl = new URL(event.request.url);
        cleanUrl.search = '';
        cacheKey = precacheController.getCacheKeyForURL(cleanUrl.href);
        if (cacheKey) {
            targetUrl = cleanUrl.href;
        }
    }

    if (cacheKey) {
        event.respondWith((async () => {
            const cached = await precacheController.matchPrecache(targetUrl);
            if (cached) return cached;
            return precacheController.strategy.handle({
                event,
                request: event.request,
                params: { cacheKey }
            });
        })());
        return;
    }
    // No respondWith: Workbox routing handles this request.
});

// Runtime routes
registerRoute(
    /^https:\/\/api\.(orecalc\.tech|clashcalc\.com)\//,
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
    ({ request, url }) => {
        if (url.origin !== self.location.origin) return false;
        if (
            url.pathname.includes('/api/') ||
            url.pathname.includes('/privacy') ||
            url.pathname.includes('/terms') ||
            url.pathname.includes('/licenses') ||
            url.pathname.includes('/legal') ||
            url.pathname.includes('/404')
        ) {
            return false;
        }
        if (request.mode === 'navigate') return true;
        return request.method === 'GET' && request.destination === '' && (url.pathname === '/' || url.pathname.endsWith('/'));
    },
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
        if (segments.length > 0 && ['en', 'de', 'tr', 'zh'].includes(segments[0].toLowerCase())) {
            lang = segments[0].toLowerCase();
        }

        let toolSubpath = '';
        if (pathname.includes('/ore-calculator')) {
            toolSubpath = 'ore-calculator/';
        } else if (pathname.includes('/hero-journey')) {
            toolSubpath = 'hero-journey/';
        } else if (pathname.includes('/damage-calculator')) {
            toolSubpath = 'damage-calculator/';
        } else if (pathname.includes('/account')) {
            toolSubpath = 'account/';
        } else if (pathname.includes('/app-management')) {
            toolSubpath = 'app-management/';
        }

        const candidateUrls = [];
        if (lang !== 'en') {
            if (toolSubpath) candidateUrls.push(`${lang}/${toolSubpath}index.html`);
            candidateUrls.push(`${lang}/index.html`);
        }
        if (toolSubpath) candidateUrls.push(`${toolSubpath}index.html`);
        candidateUrls.push('index.html');

        for (const candidate of candidateUrls) {
            try {
                const match = await precacheController.matchPrecache(candidate);
                if (match) return match;
            } catch (_) {}
            try {
                const matchSlash = await precacheController.matchPrecache('/' + candidate);
                if (matchSlash) return matchSlash;
            } catch (_) {}
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

// Runtime cache for dynamic game assets (equipment, town halls, heroes, buildings, resources)
registerRoute(
    ({ request, url }) => (request.destination === 'image' ||
        (url.origin === self.location.origin && url.pathname.startsWith('/assets/'))),
    new CacheFirst({
        cacheName: 'orecalc-assets-cache',
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({
                maxEntries: 400,
                maxAgeSeconds: 60 * 24 * 60 * 60, // 60 Days
                purgeOnQuotaError: true
            })
        ]
    })
);
