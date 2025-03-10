const CACHE_NAME = 'nabled-cache-v1';
const urlsToCache = [
    'index.html',
    'style.css',
    'script.js',
    'detail.html',
    'detailstyle.css',
    'detail.js',
    // ... add any other assets you want to cache (images, fonts, etc.)
];

self.addEventListener('install', function(event) {
    // Perform install steps
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request);
            }
        )
    );
});
