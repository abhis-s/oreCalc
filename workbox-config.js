module.exports = {
    globDirectory: 'dist/',
    globPatterns: [
        // Core App Shell HTML routes
        '{index,ore-calculator/index}.html',
        '{de,tr,zh}/{index,ore-calculator/index}.html',
        // Core App Shell Stylesheets
        'css/{main,landing}.min.css',
        // Core App Shell JavaScript and shared chunks
        'js/{app,landingApp}.js',
        'js/chunk-*.js',
        'js/workbox-window.js',
        // Canonical dictionaries and equipment progression JSON data
        'js/i18n/*.json',
        'js/data/equipment/*.json',
        'manifest.json',
        // Both image formats go into the manifest. The service worker (service-worker-src.js)
        // detects AVIF support at install time and drops the unsupported format before
        // caching anything — so only ~half the images ever touch the cache.
        'assets/*.{png,ico,webp,avif}',
        // Core Visual Game Assets (guarantees 100% offline capability across OreCalc & Landing)
        'assets/{equipment,heroes,th,resources,magicItems,avatars}/**/*.{png,webp,avif}'
    ],
    globIgnores: [
        '**/404.html',
        '**/hero-journey/**',
        '**/js/heroJourneyApp.js',
        '**/damage-calculator/**',
        '**/js/damageApp.js',
        '**/privacy/**',
        '**/terms/**',
        '**/licenses/**',
        '**/legal/**',
        '**/assets/buildings/**',
        '**/assets/skins/**',
        '**/assets/guardians/**',
        '**/assets/supercharge/**',
        '**/assets/spells/**',
        '**/assets/heroJourney/**',
        '**/assets/*_og.*',
        '**/assets/screenshot_*.*',
        '**/assets/hero_journey_*.*'
    ],
    // injectManifest: workbox-cli injects self.__WB_MANIFEST into our custom SW template.
    // All routing + runtime caching logic lives in service-worker-src.js.
    swSrc: './service-worker-src.js',
    swDest: 'dist/service-worker.js',
};
