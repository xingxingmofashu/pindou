/* Service worker for Pindou — app-shell offline support.
 *
 * Strategy:
 *  - `install`: precache the localized home pages as offline fallbacks.
 *  - Navigation: network-first. The response streams straight through to the
 *    browser (RSC streaming / `loading.tsx` skeletons keep working) while the
 *    body is buffered into the page cache in the background. On failure it
 *    falls back to the cached page matching the request's locale segment.
 *  - Same-origin static assets (`/_next/static/*`, icons at the root):
 *    stale-while-revalidate so a refreshed build's assets are picked up.
 *  - Everything else (`/api/*`, cross-origin images): never intercepted.
 *
 * Dynamic data (pattern lists, details, palette) is intentionally not cached:
 * it is served by SWR/SSR and must stay fresh.
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
    event.respondWith(navigateStrategy(event, request, path))
    return
  }

  // Same-origin static assets: stale-while-revalidate.
  if (path.startsWith("/_next/static/") || path.startsWith("/icon-") || path === "/apple-touch-icon.png") {
    event.respondWith(assetsStrategy(request, path))
  }
})

async function navigateStrategy(event, request, path) {
  const cache = await caches.open(CACHE_NAMES.pages)
  try {
    const response = await fetch(request)
    if (response.ok) {
      // Buffer the body into the page cache after handing the stream to the
      // browser, so streaming renders are not delayed by the cache write.
      event.waitUntil(cache.put(request.clone(), response.clone()))
    }
    return response
  } catch {
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
