import type { MetadataRoute } from "next"

/**
 * PWA web app manifest. Served at `/manifest.webmanifest` (root, outside the
 * `[lang]` tree and excluded from the locale proxy by the `.*\..*` matcher).
 * `start_url: "/"` is locale-agnostic — the proxy redirects to `/en`/`/zh`
 * on launch. Icons are committed PNGs derived from `public/icon@32x32.svg`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "拼豆 Pindou — Fuse Bead Pattern Editor",
    short_name: "Pindou",
    description:
      "Create, share, and discover MARD fuse bead patterns. Sign in with GitHub to publish your own patterns.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
