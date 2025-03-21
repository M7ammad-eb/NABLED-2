// service-worker.js (v7 - Corrected STATIC_ASSETS)

const CACHE_NAME = 'nabled-cache-v10';
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
            const baseURL = "/NABLED-2";  // ✅ Your actual GitHub repo name!

            return cache.addAll([
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
                `${baseURL}/service-worker.js`,
                "https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js",
                "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js",
                "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js"
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

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // ✅ Allow Firebase authentication requests to pass through
    if (
        event.request.url.includes("firebasestorage") ||
        event.request.url.includes("firebaseio.com") ||
        event.request.url.includes("accounts.google.com") ||
        event.request.url.includes("identitytoolkit")
    ) {
        event.respondWith(fetch(event.request));
        return;
    }

    // ✅ Serve cached `detail.html` for all `detail.html?id=...` requests
    if (url.pathname.endsWith("/detail.html") && url.searchParams.has("id")) {
        event.respondWith(
            caches.match("/NABLED-2/detail.html").then((cachedResponse) => {
                return cachedResponse || fetch(event.request);
            })
        );
        return;
    }

    // ✅ Ignore non-GET requests (e.g., form submissions)
    if (event.request.method !== "GET") {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return (
                cachedResponse ||
                fetch(event.request)
                    .then((networkResponse) => {
                        // ✅ Clone response & add it to cache
                        return caches.open("CACHE_NAME").then((cache) => {
                            cache.put(event.request, networkResponse.clone());
                            return networkResponse;
                        });
                    })
                    .catch(() => {
                        // ✅ Serve fallback pages when offline
                        if (event.request.mode === "navigate") {
                            return caches.match("/NABLED-2/index.html");
                        }
                        if (event.request.url.match(/\.(jpeg|jpg|gif|png|svg)$/i)) {
                            return caches.match("/NABLED-2/placeholder.png");
                        }
                        return new Response("Offline and resource not cached.", {
                            status: 503,
                            statusText: "Service Unavailable",
                        });
                    })
            );
        })
    );
});


