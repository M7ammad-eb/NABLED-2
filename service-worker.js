// service-worker.js (v7 - Corrected STATIC_ASSETS)

const CACHE_NAME = 'nabled-cache-v7'; // *** Increment the version! v7 ***
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

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async (cache) => {
                console.log('Opened cache');

                // 1. Cache static assets
                await cache.addAll(STATIC_ASSETS);

                // 2. Fetch and cache the Google Sheet data
                try {
                    const [dataResponse, permissionsResponse] = await Promise.all([
                        fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQhx959g4-I3vnLw_DBvdkCrZaJao7EsPBJ5hHe8-v0nv724o5Qsjh19VvcB7qZW5lvYmNGm_QvclFA/pub?output=csv'),
                        fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vRLwZaoxBCFUM8Vc5X6OHo9AXC-5NGfYCOIcFlEMcnRAU-XQTfuGVJGjQh0B9e17Nw4OXhoE9yImi06/pub?output=csv')
                    ]);

                    if (!dataResponse.ok || !permissionsResponse.ok) {
                        throw new Error(`Network response was not ok: ${dataResponse.status} ${permissionsResponse.status}`);
                    }

                    const dataCsvText = await dataResponse.text();
                    const permissionsCsvText = await permissionsResponse.text();

                    await Promise.all([
                        cache.put('https://docs.google.com/spreadsheets/d/e/2PACX-1vQhx959g4-I3vnLw_DBvdkCrZaJao7EsPBJ5hHe8-v0nv724o5Qsjh19VvcB7qZW5lvYmNGm_QvclFA/pub?output=csv', new Response(dataCsvText)),
                        cache.put('https://docs.google.com/spreadsheets/d/e/2PACX-1vRLwZaoxBCFUM8Vc5X6OHo9AXC-5NGfYCOIcFlEMcnRAU-XQTfuGVJGjQh0B9e17Nw4OXhoE9yImi06/pub?output=csv', new Response(permissionsCsvText))
                    ]);

                    // 3. Generate and pre-cache detail.html?id=... URLs
                    const dataRows = Papa.parse(dataCsvText, { header: false }).data;
                    const detailUrls = [];
                    for (let i = 1; i < dataRows.length; i++) {
                        const itemId = dataRows[i][0];
                        if (itemId) {
                            detailUrls.push(`/detail.html?id=${itemId}`);
                        }
                    }
                    await cache.addAll(detailUrls);

                } catch (error) {
                    console.error("Failed to pre-cache data or detail URLs:", error);
                }
            })
            .catch(error => { //Added this to catch install
                console.error("Install Failed:", error);
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
    // Let Firebase Auth requests go directly to the network.
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

                // Network request + dynamic caching (for images, primarily)
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Clone the response for caching
                        const responseToCache = networkResponse.clone();

                        // Cache images.
                        if (event.request.url.match(/\.(jpeg|jpg|gif|png|svg)$/i)) {
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        // Don't dynamically cache other things, we've pre-cached what we need.

                        return networkResponse;
                    })
                    .catch((error) => {
                        // Handle network errors gracefully.
                        console.error('Fetch failed:', error);

                        // For navigation requests, return index.html (as a fallback)
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        // For image requests, return the placeholder.
                        else if (event.request.url.match(/\.(jpeg|jpg|gif|png|svg)$/i)) {
                            return caches.match('/placeholder.png');
                        }
                        // For other failed requests, return a 503 error.
                        return new Response('Offline and resource not cached.', {
                            status: 503,
                            statusText: 'Service Unavailable',
                        });
                    });
            })
    );
});
