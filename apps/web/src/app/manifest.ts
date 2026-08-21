import { headers } from "next/headers"
import type { MetadataRoute } from "next"
import { detectLocale } from "@pindou/core/i18n/config"

/**
 * PWA web app manifest. Served at `/manifest.webmanifest` (root, outside the
 * `[lang]` tree and excluded from the locale proxy by the `.*\..*` matcher).
 * The installed app name follows the visitor's language (`Accept-Language`,
 * same detection as the locale proxy): `zh` → 拼豆, `en` → Pindou.
 * `start_url: "/"` is locale-agnostic — the proxy redirects to `/en`/`/zh`
 * on launch. Icons are committed PNGs derived from `public/icon@32x32.svg`.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = detectLocale((await headers()).get("accept-language"))

  const isZh = locale === "zh"

  return {
    name: isZh ? "拼豆" : "Pindou",
    short_name: isZh ? "拼豆" : "Pindou",
    description: isZh
      ? "创建、分享和发现拼豆图案。使用 GitHub 登录即可发布自己的作品。"
      : "Create, share, and discover MARD fuse bead patterns. Sign in with GitHub to publish your own patterns.",
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
