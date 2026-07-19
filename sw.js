const CACHE = 'a-nous-v4';
const ASSETS = ['./','./index.html','./styles.css?v=4','./app.js?v=4','./manifest.webmanifest','./icon.svg','./venue-bistro.jpg','./venue-family.jpg','./venue-rooftop.jpg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request))));
