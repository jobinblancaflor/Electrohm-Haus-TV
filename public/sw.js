// Basic service worker to satisfy PWA install criteria
const CACHE_NAME = 'electrohm-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Let the browser handle the request normally
  // This is the simplest SW that allows PWA installation
});
