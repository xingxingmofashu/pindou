import type { MetadataRoute } from "next"
import { getAllPatternIds } from "@/lib/server/patterns"
import { SITE_URL } from "@/lib/server/meta"
import { localizedPath, locales } from "@pindou/core/i18n/config"

const STATIC_PATHS = ["/", "/patterns", "/editor"] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ids = await getAllPatternIds()

  const entries: MetadataRoute.Sitemap = []
  for (const locale of locales) {
    for (const path of STATIC_PATHS) {
      entries.push({
        url: new URL(localizedPath(locale, path), SITE_URL).toString(),
        changeFrequency: path === "/" ? "monthly" : "weekly",
        priority: path === "/" ? 1 : 0.8,
      })
    }
    for (const id of ids) {
      entries.push({
        url: new URL(localizedPath(locale, `/patterns/${id}`), SITE_URL).toString(),
        changeFrequency: "monthly",
        priority: 0.6,
      })
    }
  }

  return entries
}
