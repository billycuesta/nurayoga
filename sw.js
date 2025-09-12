const CACHE_NAME = 'nura-yoga-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/js/utils.js',
  '/js/database.js',
  '/js/ui.js',
  '/js/models/Student.js',
  '/js/models/Class.js',
  '/js/models/Teacher.js',
  '/js/app.js',
  // Iconos (solo los que existen)
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // CDN de Tailwind (para modo offline básico)
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;500&display=swap'
];

// Evento de instalación
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache abierto');
        // Intentar cachear los archivos uno por uno para evitar fallos
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(error => {
              console.warn(`No se pudo cachear ${url}:`, error);
              return null;
            })
          )
        );
      })
      .then(() => {
        console.log('Service Worker: Archivos cacheados');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Error durante la instalación del SW:', error);
      })
  );
});

// Evento de activación
self.addEventListener('activate', event => {
  console.log('Service Worker: Activando...');
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (!cacheWhitelist.includes(cacheName)) {
              console.log('Service Worker: Borrando caché antiguo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activado y listo');
        return self.clients.claim();
      })
      .catch(error => {
        console.error('Error durante la activación del SW:', error);
      })
  );
});

// Evento fetch con estrategia Cache First + Network Fallback
self.addEventListener('fetch', event => {
  // Solo interceptar peticiones HTTP/HTTPS
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Si está en caché, devolverlo
        if (cachedResponse) {
          return cachedResponse;
        }

        // Si no está en caché, ir a la red
        return fetch(event.request)
          .then(response => {
            // Si la respuesta no es válida, no cachear
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clonar la respuesta para cachearla
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                // Solo cachear recursos de nuestra app
                if (event.request.url.includes(self.location.origin)) {
                  cache.put(event.request, responseToCache);
                }
              });

            return response;
          })
          .catch(error => {
            console.log('Error de red, buscando en caché:', error);
            // En caso de error de red, intentar servir página offline si existe
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
            throw error;
          });
      })
  );
});

// Mensaje desde la aplicación principal
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});