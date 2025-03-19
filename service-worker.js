// service-worker.js (REVISED)

const CACHE_NAME = 'nabled-cache-v4'; // Increment the version!
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/detail.html',
    '/detailstyle.css',
    '/detail.js',
    '/logo.png',
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js',
    'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                // Add static assets
                return cache.addAll(STATIC_ASSETS)
                    .then(() => {
                      // Pre-cache the Google Sheet data.
                      // CRUCIAL: Return the Promises so waitUntil waits for completion.
                      return Promise.all([
                          fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQhx959g4-I3vnLw_DBvdkCrZaJao7EsPBJ5hHe8-v0nv724o5Qsjh19VvcB7qZW5lvYmNGm_QvclFA/pub?output=csv')
                              .then(response => response.text())
                              .then(data => cache.put('https://docs.google.com/spreadsheets/d/e/2PACX-1vQhx959g4-I3vnLw_DBvdkCrZaJao7EsPBJ5hHe8-v0nv724o5Qsjh19VvcB7qZW5lvYmNGm_QvclFA/pub?output=csv', new Response(data))),
                          fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vRLwZaoxBCFUM8Vc5X6OHo9AXC-5NGfYCOIcFlEMcnRAU-XQTfuGVJGjQh0B9e17Nw4OXhoE9yImi06/pub?output=csv')
                              .then(response => response.text())
                              .then(data => cache.put('https://docs.google.com/spreadsheets/d/e/2PACX-1vRLwZaoxBCFUM8Vc5X6OHo9AXC-5NGfYCOIcFlEMcnRAU-XQTfuGVJGjQh0B9e17Nw4OXhoE9yImi06/pub?output=csv', new Response(data)))
                        ]);
                    });
            })
            .catch((err) => {
                console.error("Failed to cache assets", err);
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
