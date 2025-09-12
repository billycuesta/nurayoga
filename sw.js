// Define un nombre para el caché actual.
const CACHE_NAME = 'nura-yoga-admin-v1';

// Lista de archivos y recursos que la PWA necesita para funcionar offline.
const urlsToCache = [
  '/',
  'index.html',
  'style.css',
  'app.js',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;500&display=swap'
];

// Evento 'install': se dispara cuando el Service Worker se instala.
// Aquí abrimos el caché y guardamos nuestros archivos.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento 'fetch': se dispara cada vez que la app solicita un recurso (una página, un CSS, una imagen, etc.).
// La estrategia es "Cache First": primero intenta servir desde el caché. Si no lo encuentra, va a la red.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si el recurso está en el caché, lo devolvemos desde ahí.
        if (response) {
          return response;
        }
        // Si no, lo pedimos a la red.
        return fetch(event.request);
      }
    )
  );
});

// Evento 'activate': se dispara cuando el Service Worker se activa.
// Sirve para limpiar cachés antiguos si hemos actualizado la versión.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
