/* PAPER PLANET — service worker. Offline is a feature: folding needs no network. */

const VERSION = 'pp-v1'
const SHELL_CACHE = `${VERSION}-shell`
const AUDIO_CACHE = `${VERSION}-audio`
const IMAGE_CACHE = `${VERSION}-img`

/* Only the entry document is precached; hashed build assets are picked up on
   first use, which keeps install fast and avoids a stale precache manifest. */
const PRECACHE = ['./', './index.html', './manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined) // a failed precache must not block activation
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

function isAudio(url) {
  return /\.(mp3|ogg|m4a|wav|webm)$/i.test(url.pathname)
}
function isImage(url) {
  return /\.(png|jpe?g|svg|webp|avif)$/i.test(url.pathname)
}
function isBuildAsset(url) {
  return url.pathname.includes('/assets/') || /\.(js|css)$/i.test(url.pathname)
}

/** Cache-first: the asset is immutable or expensive, and staleness is fine. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  try {
    const res = await fetch(request)
    // Opaque responses are cached too — they're CDN fonts we can't inspect.
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone())
    return res
  } catch (err) {
    const fallback = await cache.match(request)
    if (fallback) return fallback
    throw err
  }
}

/** Network-first with a cache fallback: for the app document itself. */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(request)
    if (res && res.ok) cache.put(request, res.clone())
    return res
  } catch {
    const hit = (await cache.match(request)) || (await cache.match('./index.html'))
    if (hit) return hit
    return new Response('Offline', { status: 503, statusText: 'Offline' })
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Never touch cross-origin analytics/API traffic.
  if (url.origin !== self.location.origin && !isImage(url) && !isAudio(url)) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE))
    return
  }
  if (isAudio(url)) {
    event.respondWith(cacheFirst(request, AUDIO_CACHE))
    return
  }
  if (isImage(url)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE))
    return
  }
  if (isBuildAsset(url)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE))
  }
})

/* The app asks for an immediate update when the player taps "Reload". */
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})
