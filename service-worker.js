// service-worker.js (FINAL - Correctly Handles ALL Offline Cases)

const CACHE_NAME = 'nabled-cache-v5'; // Keep v5
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/detail.html',
    '/detailstyle.css',
    '/detail.js',
    '/logo.png',
    '/placeholder.png',
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js',
    'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(STATIC_ASSETS)
                    .then(() => {
                        // Pre-cache the Google Sheet data
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


self.addEventListener('fetch', (event) => {
  // Let Firebase Auth requests go directly to the network.  Do NOT cache.
    if (event.request.url.includes('firebasestorage') || event.request.url.includes('firebaseio.com') || event.request.url.includes('accounts.google.com') || event.request.url.includes('identitytoolkit')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Ignore non-GET requests
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
                        // Clone the response for caching
                        const responseToCache = networkResponse.clone();

                        // Cache images and other requests.
                        if (event.request.url.match(/\.(jpeg|jpg|gif|png|svg)$/i)) {
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                        } else {
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return networkResponse;
                    })
                    .catch((error) => {
                        // Handle network errors gracefully.
                        console.error('Fetch failed:', error);

                        // For navigation requests (e.g., detail.html), return the cached index.html.
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        // For image requests, return the placeholder.
                        else if (event.request.url.match(/\.(jpeg|jpg|gif|png|svg)$/i)) {
                            return caches.match('/placeholder.png');
                        }
                        // For other failed requests, there's no good fallback.
                        // Return a simple error response.  This prevents the "respondWith()" error.
                        return new Response('Offline and resource not cached.', { //This is important
                            status: 503,
                            statusText: 'Service Unavailable',
                        });
                    });
            })
    );
});
