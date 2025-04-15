const CACHE_NAME = 'nabled-cache-v18'; // Increment version to force update
// Define baseURL based on potential deployment environment (e.g., GitHub Pages subdirectory)
// Adjust '/NABLED-2' to your actual repository name if using GitHub Pages, or '' if deploying at the root.
const baseURL = '/NABLED-2'; // Example: for https://username.github.io/NABLED-2/
// const baseURL = ''; // Example: for https://yourdomain.com/

const STATIC_ASSETS = [
    `${baseURL}/`,
    `${baseURL}/index.html`,
    `${baseURL}/style.css`,
    `${baseURL}/script.js`,
    `${baseURL}/detail.html`,
    `${baseURL}/detailstyle.css`,
    `${baseURL}/detail.js`,
    `${baseURL}/logo.png`,
    `${baseURL}/placeholder.png`,
    `${baseURL}/manifest.json`,
    `${baseURL}/signin.html`, // Make sure signin page is cached if needed offline
    // Add other static assets like CSS for signin page if applicable
    // External resources are cached separately if fetched via SW fetch handler
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js',
    'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js',
];


self.addEventListener("install", (event) => {
    console.log(`[SW ${CACHE_NAME}] Install event`);
    event.waitUntil(
        // --- Use the CACHE_NAME variable, not the string "CACHE_NAME" ---
        caches.open(CACHE_NAME).then((cache) => {
            console.log(`[SW ${CACHE_NAME}] Caching static assets with baseURL: '${baseURL}'`);
            return cache.addAll(STATIC_ASSETS)
                .then(() => {
                    console.log(`[SW ${CACHE_NAME}] Static assets cached successfully!`);
                    // Force the waiting service worker to become the active service worker.
                    return self.skipWaiting();
                })
                .catch(err => {
                    console.error(`[SW ${CACHE_NAME}] Failed to cache static assets:`, err);
                    // Log which asset failed if possible
                    STATIC_ASSETS.forEach(assetUrl => {
                        fetch(assetUrl).catch(fetchErr => console.error(`[SW ${CACHE_NAME}] Failed fetch check for: ${assetUrl}`, fetchErr));
                    });
                });
        })
    );
});

self.addEventListener('activate', (event) => {
    console.log(`[SW ${CACHE_NAME}] Activate event`);
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete caches that are no longer needed (different name and start with 'nabled-cache')
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

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // --- Network-Only for Google Sheets Data ---
    // Always fetch Google Sheet CSVs directly from network to ensure freshness,
    // especially since the app logic now handles offline via localStorage.
    // The cache-busting in script.js primarily helps bypass browser HTTP cache,
    // this rule ensures SW doesn't interfere by serving stale cache data.
    if (url.origin === 'https://docs.google.com' && url.pathname.includes('/pub?output=csv')) {
         console.log(`[SW ${CACHE_NAME}] Fetching Google Sheet from network: ${url.pathname}`);
         event.respondWith(fetch(event.request));
         return; // Don't apply other rules
    }


    // Allow Firebase and Google auth/identity requests to pass through directly
     if (
        url.hostname.includes("firebasestorage") ||
        url.hostname.includes("firebaseio.com") || // May not be needed with compat library, but safe to keep
        url.hostname.includes("googleapis.com") || // Covers Firestore, Identity Toolkit etc.
        url.hostname.includes("google.com") || // Broad rule for Google services like auth
        url.hostname.includes("gstatic.com") // For Firebase JS SDKs etc.
    ) {
        // console.log(`[SW ${CACHE_NAME}] Allowing network request for Google/Firebase: ${url.href}`);
        event.respondWith(fetch(event.request));
        return; // Don't apply other rules
    }

    // Serve cached `detail.html` for all `detail.html?id=...` requests
    // Ensure the path matches the baseURL structure
    const detailPath = `${baseURL}/detail.html`;
    if (url.pathname === detailPath && url.searchParams.has("id")) {
        console.log(`[SW ${CACHE_NAME}] Serving cached detail page: ${detailPath}`);
        event.respondWith(
            caches.match(detailPath).then((cachedResponse) => {
                // Fallback to network if somehow not cached (should be by install)
                return cachedResponse || fetch(event.request);
            })
        );
        return; // Don't apply other rules
    }

    // Ignore non-GET requests
    if (event.request.method !== "GET") {
        // console.log(`[SW ${CACHE_NAME}] Ignoring non-GET request: ${event.request.method} ${url.pathname}`);
        event.respondWith(fetch(event.request));
        return; // Don't apply other rules
    }


    // --- Cache-First Strategy for Static Assets & Others ---
    // For everything else (static assets, maybe images not handled elsewhere)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // console.log(`[SW ${CACHE_NAME}] Serving from cache: ${url.pathname}`);
                return cachedResponse;
            }

            // console.log(`[SW ${CACHE_NAME}] Fetching from network: ${url.pathname}`);
            return fetch(event.request)
                .then((networkResponse) => {
                    // Cache the fetched resource if it's a valid response
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                         // console.log(`[SW ${CACHE_NAME}] Caching network response for: ${url.pathname}`);
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    } else if(networkResponse && networkResponse.status !== 200) {
                        console.warn(`[SW ${CACHE_NAME}] Not caching non-200 response for: ${url.pathname}, Status: ${networkResponse.status}`);
                    } else if (networkResponse && networkResponse.type !== 'basic') {
                         // console.log(`[SW ${CACHE_NAME}] Not caching non-basic response type '${networkResponse.type}' for: ${url.pathname}`);
                    }
                    return networkResponse;
                })
                .catch(() => {
                    console.log(`[SW ${CACHE_NAME}] Network fetch failed, attempting fallback for: ${url.pathname}`);
                    // --- Offline Fallback ---
                    // If navigating to a page
                    if (event.request.mode === "navigate") {
                        console.log(`[SW ${CACHE_NAME}] Serving fallback index page.`);
                        return caches.match(`${baseURL}/index.html`);
                    }
                    // If requesting an image
                    if (event.request.destination === "image") {
                        console.log(`[SW ${CACHE_NAME}] Serving fallback placeholder image.`);
                        return caches.match(`${baseURL}/placeholder.png`);
                    }
                    // Generic offline response for other uncached resources
                    console.log(`[SW ${CACHE_NAME}] Serving generic offline response.`);
                    return new Response("You are offline and this resource isn't cached.", {
                        status: 503,
                        statusText: "Service Unavailable",
                        headers: { "Content-Type": "text/plain" },
                    });
                });
        })
    );
});
