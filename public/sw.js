const CACHE_VERSION = 'hse-cache-v2'
const STATIC_PATTERNS = [/^\/_next\/static\//, /^\/brand\//, /^\/icons\//, /^\/manifest\.json$/]
const SWR_PATTERNS = [/^\/api\/daily-quizzes(\?|$)/, /^\/api\/games(\?|$)/]

self.addEventListener('install', event => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

function isStatic(url) {
  return STATIC_PATTERNS.some(re => re.test(url.pathname)) || url.hostname.endsWith('supabase.co')
}
function isStaleWhileRevalidate(url) {
  if (url.origin !== self.location.origin) return false
  if (url.searchParams.get('admin') === 'true') return false
  return SWR_PATTERNS.some(re => re.test(url.pathname))
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (isStatic(url)) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async cache => {
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok || response.type === 'opaque') cache.put(request, response.clone())
        return response
      })
    )
    return
  }

  if (isStaleWhileRevalidate(url)) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async cache => {
        const cached = await cache.match(request)
        const networkPromise = fetch(request).then(response => {
          if (response.ok) cache.put(request, response.clone())
          return response
        }).catch(() => cached)
        return cached || networkPromise
      })
    )
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone()))
        return response
      }).catch(() => caches.open(CACHE_VERSION).then(cache => cache.match(request).then(cached => cached || caches.match('/'))))
    )
  }
})

self.addEventListener('push', event => {
  let payload = { title: 'HSE Safety', body: 'Шинэ мэдэгдэл ирлээ.' }
  try { if (event.data) payload = { ...payload, ...event.data.json() } } catch { /* keep default */ }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
