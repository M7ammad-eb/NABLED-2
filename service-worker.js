// Increment version when static assets change
const CACHE_NAME = 'nabled-cache-v95'; // Updated version
// Adjust baseURL if deploying to a subdirectory (e.g., '/RepoName')
const baseURL = '/NABLED-2'; // Example for GitHub Pages subdirectory
// const baseURL = ''; // Example for root deployment

// --- List of essential static assets to cache ---
// Removed detail.html, detail.js, detailstyle.css
const STATIC_ASSETS = [
    `${baseURL}/`, // Root index (often redirects to index.html)
    `${baseURL}/index.html`,
    `${baseURL}/style.css`,
    `${baseURL}/script.js`,
    `${baseURL}/logo.png`,
    `${baseURL}/logo.svg`,
    `${baseURL}/placeholder.png`,
    `${baseURL}/Saudi_Riyal_Symbol-2.svg`,
    `${baseURL}/manifest.json`,
    `${baseURL}/signin.html`, // Cache sign-in page
    // Add signin.css if it exists
    // External libraries (will be cached on first fetch by the fetch handler if not already cached here)
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js',
    'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js',
];

// --- Install Event: Cache Static Assets ---
self.addEventListener("install", (event) => {
    console.log(`[SW ${CACHE_NAME}] Install event`);
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log(`[SW ${CACHE_NAME}] Caching static assets with baseURL: '${baseURL}'`);
            // Use Promise.allSettled to attempt caching all assets even if some fail
            return Promise.allSettled(
                STATIC_ASSETS.map(url => cache.add(url).catch(err => {
                    console.error(`[SW ${CACHE_NAME}] Failed to cache: ${url}`, err);
                    // Don't reject the whole promise, just log the error for the specific asset
                    return Promise.reject(err); // Or resolve to indicate handled failure
                }))
            ).then(results => {
                const failed = results.filter(result => result.status === 'rejected');
                if (failed.length > 0) {
                    console.warn(`[SW ${CACHE_NAME}] Some static assets failed to cache.`);
                } else {
                    console.log(`[SW ${CACHE_NAME}] All specified static assets cached or attempted.`);
                }
                // Force activation immediately after install success
                return self.skipWaiting();
            });
        }).catch(err => {
             console.error(`[SW ${CACHE_NAME}] Failed to open cache during install:`, err);
        })
    );
});

// --- Activate Event: Clean Up Old Caches ---
self.addEventListener('activate', (event) => {
    console.log(`[SW ${CACHE_NAME}] Activate event`);
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete caches that are no longer needed (different name AND start with 'nabled-cache')
                    if (cacheName !== CACHE_NAME && cacheName.startsWith('nabled-cache')) {
                        console.log(`[SW ${CACHE_NAME}] Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log(`[SW ${CACHE_NAME}] Claiming clients`);
             // Take control of currently open clients immediately
            return self.clients.claim();
        })
    );
});

// --- Fetch Event: Handle Network Requests ---
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // --- Strategy 1: Network Only for Google Sheets Data ---
    // Always fetch Google Sheet CSVs directly from network.
    if (url.origin === 'https://docs.google.com' && url.pathname.includes('/pub?output=csv')) {
         // console.log(`[SW ${CACHE_NAME}] Network-Only Fetch: Google Sheet ${url.pathname}`);
         event.respondWith(fetch(event.request));
         return; // Stop processing here
    }

    // --- Strategy 2: Network Only for Firebase/Google Auth/API calls ---
    // Allow essential backend communication to pass through.
     if (
         url.hostname.includes("firebasestorage") || // Storage
         url.hostname.includes("firebaseio.com") || // Realtime DB (if used)
         url.hostname.includes("firestore.googleapis.com") || // Firestore
         url.hostname.includes("identitytoolkit.googleapis.com") || // Auth backend
         url.hostname.includes("google.com") || // Broad Google APIs (includes auth redirects etc)
         url.hostname.includes("googleapis.com") // Other Google APIs
         // Note: gstatic.com (for SDKs) will be handled by Cache-First below
     ) {
         // console.log(`[SW ${CACHE_NAME}] Network-Only Fetch: Google/Firebase API ${url.href}`);
         event.respondWith(fetch(event.request));
         return; // Stop processing here
     }

    // --- Strategy 3: Cache First (with Network Fallback & Cache Update) for Static Assets & Others ---
    // Handle GET requests for app shell, static assets, libraries etc.
    if (event.request.method === "GET") {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                // 1. Cache Hit: Return cached response immediately
                if (cachedResponse) {
                    // console.log(`[SW ${CACHE_NAME}] Cache Hit: ${url.pathname}`);
                    return cachedResponse;
                }

                // 2. Cache Miss: Go to Network
                // console.log(`[SW ${CACHE_NAME}] Cache Miss, Fetching: ${url.pathname}`);
                return fetch(event.request).then((networkResponse) => {
                    // 3. Network Success: Cache the response and return it
                    if (networkResponse && networkResponse.status === 200) {
                        // Cache only basic (same-origin) or explicitly allowed cross-origin responses
                        // Check if it's a static asset or library we *want* to cache
                        const isCachableAsset = STATIC_ASSETS.some(asset => url.href.endsWith(asset.replace(baseURL, ''))) || url.hostname.includes("gstatic.com"); // Cache Firebase SDKs too

                        if (networkResponse.type === 'basic' || isCachableAsset) {
                           // console.log(`[SW ${CACHE_NAME}] Caching Network Response: ${url.pathname}`);
                           const responseToCache = networkResponse.clone(); // Clone response
                           caches.open(CACHE_NAME).then((cache) => {
                               cache.put(event.request, responseToCache);
                           });
                        } else {
                            // console.log(`[SW ${CACHE_NAME}] Not Caching (Type: ${networkResponse.type}): ${url.pathname}`);
                        }
                    } else if (networkResponse) {
                         console.warn(`[SW ${CACHE_NAME}] Network fetch failed with status ${networkResponse.status}: ${url.pathname}`);
                    }
                    return networkResponse; // Return network response (even if error, like 404)

                }).catch((error) => {
                    // 4. Network Failure (Offline): Provide Fallback
                    console.log(`[SW ${CACHE_NAME}] Network Fetch Failed (Offline?): ${url.pathname}`, error);

                    // Fallback for navigation requests (return index.html)
                    if (event.request.mode === "navigate") {
                        console.log(`[SW ${CACHE_NAME}] Serving fallback index page.`);
                        return caches.match(`${baseURL}/index.html`);
                    }
                    // Fallback for image requests (return placeholder)
                    if (event.request.destination === "image") {
                        console.log(`[SW ${CACHE_NAME}] Serving fallback placeholder image.`);
                        return caches.match(`${baseURL}/placeholder.png`);
                    }
                    // Generic offline response for other failed requests
                    return new Response("You are offline and this resource isn't cached.", {
                        status: 503, statusText: "Service Unavailable", headers: { "Content-Type": "text/plain" },
                    });
                });
            })
        );
    } else {
        // For non-GET requests, just pass through to the network
        // console.log(`[SW ${CACHE_NAME}] Ignoring non-GET request: ${event.request.method} ${url.pathname}`);
        event.respondWith(fetch(event.request));
    }
});
