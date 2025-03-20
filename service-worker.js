// service-worker.js (v7 - Corrected STATIC_ASSETS)

const CACHE_NAME = 'nabled-cache-v8'; // *** Increment the version! v8 ***
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
    '/manifest.json', // Add manifest.json!
    '/service-worker.js',
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js',
    'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js',
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open("CACHE_NAME").then((cache) => {
            return cache.addAll([
                '/',
                '/index.html',
                '/style.css',
                '/script.js',
                '/detail.html',
                '/detailstyle.css',
                '/detail.js',
                '/logo.png',
                '/placeholder.png',
                '/manifest.json', // Add manifest.json!
                '/service-worker.js',
                'https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js',
                'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js',
                'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js',
            ]).then(() => {
                console.log("Cache successfully added!");
            }).catch(err => console.error("Failed to cache files:", err));
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
    const url = new URL(event.request.url);

    // Allow Firebase authentication requests to pass through
    if (event.request.url.includes('firebasestorage') || event.request.url.includes('firebaseio.com') || event.request.url.includes('accounts.google.com') || event.request.url.includes('identitytoolkit')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Serve cached `detail.html` for all `detail.html?id=...` requests
    if (url.pathname === '/detail.html' && url.searchParams.has('id')) {
        event.respondWith(
            caches.match('/detail.html').then((cachedResponse) => {
                return cachedResponse || fetch(event.request);
            })
        );
        return;
    }

    // Ignore non-GET requests
    if (event.request.method !== 'GET') {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request)
                .then((networkResponse) => {
                    const responseToCache = networkResponse.clone();

                    if (event.request.url.match(/\.(jpeg|jpg|gif|png|svg)$/i)) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }

                    return networkResponse;
                })
                .catch(() => {
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                    if (event.request.url.match(/\.(jpeg|jpg|gif|png|svg)$/i)) {
                        return caches.match('/placeholder.png');
                    }
                    return new Response('Offline and resource not cached.', {
                        status: 503,
                        statusText: 'Service Unavailable',
                    });
                });
        })
    );
});

