const VERSION = '2026-06-12-cache-busting-v1'
const CACHE = `restricciones-trafico-${VERSION}`
const ASSETS = [
  '/',
  `/styles.css?v=${VERSION}`,
  `/app.js?v=${VERSION}`,
  `/version.js?v=${VERSION}`,
  `/manifest.webmanifest?v=${VERSION}`,
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png'
]
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('restricciones-trafico-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/api/')) return
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/')))
    return
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)))
})
