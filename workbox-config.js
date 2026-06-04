module.exports = {
    globDirectory: 'dist/',
    globPatterns: [
        // Both image formats go into the manifest. The service worker (service-worker-src.js)
        // detects AVIF support at install time and drops the unsupported format before
        // caching anything — so only ~half the images ever touch the cache.
        '**/*.{js,css,html,png,jpg,jpeg,svg,gif,json,ico,webp,avif,txt}'
    ],
    // injectManifest: workbox-cli injects self.__WB_MANIFEST into our custom SW template.
    // All routing + runtime caching logic lives in service-worker-src.js.
    swSrc: './service-worker-src.js',
    swDest: 'dist/service-worker.js',
};
