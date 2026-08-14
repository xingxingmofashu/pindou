/* Service worker for Pindou — app-shell offline support.
 *
 * Strategy:
 *  - `install`: precache the localized home pages as offline fallbacks.
 *  - Navigation: network-first. On success the response streams straight
 *    through (RSC streaming / `loading.tsx` skeletons keep working); nothing
 *    is written to cache. On failure it falls back to the cached page matching
 *    the request's locale segment. Visited pages are NOT cached: they are
 *    dynamic (SWR/SSR data, session-dependent views) and must stay fresh, and
 *    the offline fallback is always the locale home page.
 *  - Same-origin static assets (`/_next/static/*`, icons at the root):
 *    stale-while-revalidate so a refreshed build's assets are picked up.
 *  - Everything else (`/api/*`, cross-origin images): never intercepted.
 *
 * Note: the offline shell is fully usable only after the service worker has
 * controlled at least one page load — the entry-point assets are cached
 * stale-while-revalidate on first controlled navigation.
 */
const CACHE_NAMES = {
  pages: "pindou-pages-v1",
  assets: "pindou-assets-v1",
}

const FALLBACK_PAGES = ["/en", "/zh"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAMES.pages)
      .then((cache) =>
        // allSettled-style: a failed prefetch of one locale page (e.g. a
        // transient 5xx) must not block activation — the others still cache.
        Promise.all(
          FALLBACK_PAGES.map((page) => cache.add(page).catch(() => {})),
        ),
      )
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !Object.values(CACHE_NAMES).includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

/** Prepend a leading slash and strip any `?query`/`#hash`. */
function localPath(url) {
  const { pathname } = new URL(url)
  return pathname.startsWith("/") ? pathname : `/${pathname}`
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  const path = localPath(url)

  // Dynamic API responses must never be served from cache.
  if (path.startsWith("/api/")) return

  if (request.mode === "navigate") {
    event.respondWith(navigateStrategy(request, path))
    return
  }

  // Same-origin static assets: stale-while-revalidate.
  if (path.startsWith("/_next/static/") || path.startsWith("/icon-") || path === "/apple-touch-icon.png") {
    event.respondWith(assetsStrategy(request, path))
  }
})

async function navigateStrategy(request, path) {
  try {
    return await fetch(request)
  } catch {
    const cache = await caches.open(CACHE_NAMES.pages)
    const [, lang] = path.split("/")
    const fallback = FALLBACK_PAGES.includes(`/${lang}`) ? `/${lang}` : "/en"
    const cached = await cache.match(fallback, { ignoreSearch: true })
    if (cached) return cached
    return Response.error()
  }
}

async function assetsStrategy(request, path) {
  const cache = await caches.open(CACHE_NAMES.assets)
  const cached = await cache.match(path, { ignoreSearch: true })
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(path, response.clone())
      return response
    })
    .catch(() => cached)
  return cached || network
}
