// service-worker.js (REVISED)

const CACHE_NAME = 'nabled-cache-v3'; // IMPORTANT: Increment version on every change!
const STATIC_ASSETS = [
    '/', // IMPORTANT: Cache the root URL (index.html)
    '/index.html',
    '/style.css',
    '/script.js',
    '/detail.html',
    '/detailstyle.css',
    '/detail.js',
    '/logo.png',  // Cache your icon!
    // Add other static assets here (fonts, images, etc.)
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js',
    'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js',
];

// Install: Cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch((err) => {
                console.error("Failed to cache static assets", err);
            })
    );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName.startsWith('nabled-cache')) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch: Cache-first, then network, with dynamic caching
self.addEventListener('fetch', (event) => {
    // Don't cache Firebase API requests.  Let these go directly to the network.
    if (event.request.url.includes('firebasestorage') || event.request.url.includes('firebaseio.com') || event.request.url.includes('accounts.google.com')) {
      event.respondWith(fetch(event.request));
      return;
    }

    // Ignore non-GET requests (like POST, which you might use for forms later)
    if (event.request.method !== 'GET') {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Cache hit - return the cached response
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Network request + dynamic caching
                return fetch(event.request)
                    .then((networkResponse) => {
                        // IMPORTANT: Clone the response.  A response is a stream
                        // and can only be consumed once.  We need to clone it
                        // to put one copy in the cache and serve one to the browser.
                        const responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    })
                    .catch((error) => {
                        // OFFLINE: If fetch fails (no network), try to serve
                        // a fallback page (if you have one).  This is crucial
                        // for a good offline experience.
                        console.error('Fetch failed; returning cached response:', error);
                         if (event.request.mode === 'navigate') {
                            return caches.match('/index.html'); // Fallback to index.html
                         }
                         // If it is not the index.html, let the request fails.
                         throw error;
                    });
            })
    );
});
