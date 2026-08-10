import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/server/meta"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Locale-prefixed paths; robots rules are prefix matches, so list each
      // locale's sign-in explicitly.
      disallow: ["/api/", "/en/sign-in", "/zh/sign-in"],
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
  }
}
