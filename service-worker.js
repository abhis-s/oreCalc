// This is a minimal, no-op service worker for development.
// It allows the app to run in dev mode without generating 404 errors for the service worker script.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  console.log('Dev service worker activated');
});

self.addEventListener('fetch', (event) => {
  // This no-op fetch handler is essential.
  // It ensures the service worker does not interfere with network requests during development.
  return;
});
