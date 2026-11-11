module.exports = {
    globDirectory: 'dist/',
    globPatterns: [
        // Core App Shell HTML routes
        '{index,ore-calculator/index,hero-journey/index,damage-calculator/index,account/index}.html',
        '{de,tr,zh}/{index,ore-calculator/index,hero-journey/index,damage-calculator/index,account/index}.html',
        // Core App Shell Stylesheets
        'css/{main,landing,hero-journey,damage-calculator,account}.min.css',
        // Core App Shell JavaScript and shared chunks
        'js/{app,landingApp,heroJourneyApp,damageApp,accountApp}.js',
        'js/chunk-*.js',
        'js/workbox-window.js',
        'js/qr-code-styling.js',
        // Canonical dictionaries, progression data, and damage target matrices
        'js/i18n/*.json',
        'js/data/equipment/*.json',
        'js/data/equipmentRecommendations.json',
        'js/data/targets/*.json',
        'manifest.json',
        // Both image formats go into the manifest. The service worker (service-worker-src.js)
        // detects AVIF support at install time and drops the unsupported format before
        // caching anything — so only ~half the images ever touch the cache.
        'assets/*.{png,ico,webp,avif}',
        // Core Visual Game Assets (guarantees 100% offline capability across OreCalc, Hero Journey & Damage Calc)
        'assets/{equipment,heroes,th,resources,magicItems,avatars,spells,heroJourney}/**/*.{png,webp,avif}'
    ],
    globIgnores: [
        '**/404.html',
        '**/privacy/**',
        '**/terms/**',
        '**/licenses/**',
        '**/legal/**',
        '**/assets/buildings/**',
        '**/assets/skins/**',
        '**/assets/guardians/**',
        '**/assets/supercharge/**',
        '**/assets/*_og.*',
        '**/assets/screenshot_*.*'
    ],
    // injectManifest: workbox-cli injects self.__WB_MANIFEST into our custom SW template.
    // All routing + runtime caching logic lives in service-worker-src.js.
    swSrc: './service-worker-src.js',
    swDest: 'dist/service-worker.js',
};
