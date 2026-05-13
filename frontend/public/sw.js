const STATIC_CACHE = 'cloud-vault-static-v2'
const API_CACHE = 'cloud-vault-api-v1'
const STATIC_ASSETS = ['/', '/manifest.webmanifest', '/pwa-192.svg', '/pwa-512.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  const keep = new Set([STATIC_CACHE, API_CACHE])
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) {
      return cached
    }
    return new Response(JSON.stringify({ code: 'OFFLINE', message: 'offline cache miss' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  if (cached) {
    return cached
  }
  const response = await fetch(request)
  if (response.ok) {
    await cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return
  }

  if (url.pathname.startsWith('/api/v1/')) {
    event.respondWith(networkFirst(request, API_CACHE))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, STATIC_CACHE))
    return
  }

  event.respondWith(cacheFirst(request))
})
