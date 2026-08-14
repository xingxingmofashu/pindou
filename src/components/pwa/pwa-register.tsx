"use client"

import { useEffect } from "react"

/**
 * Registers the PWA service worker (`/sw.js`) in production builds only.
 * `next dev` intentionally skips registration: the dev server serves
 * un-hashed, un-cached assets where an SW would confuse HMR and caching.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      if (process.env.NODE_ENV === "production") {
        console.error("[pwa] service worker registration failed", error)
      }
    })
  }, [])

  return null
}
