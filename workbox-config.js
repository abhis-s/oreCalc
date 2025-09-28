module.exports = {
  globDirectory: 'dist/',
  globPatterns: [
    '**/*.{js,css,html,png,jpg,jpeg,svg,gif,json,ico,webp}'
  ],
  swDest: 'dist/service-worker.js',
  runtimeCaching: [{
    urlPattern: /^https:\/\/api\.orecalc\.tech\//,
    handler: 'NetworkFirst',
    options: {
      cacheName: 'api-cache',
      networkTimeoutSeconds: 10,
      cacheableResponse: {
        statuses: [0, 200],
      },
    },
  }, {
    urlPattern: ({ request }) => request.mode === 'navigate',
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'navigation-cache',
    },
  }],
  clientsClaim: true,
};

