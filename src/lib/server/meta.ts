import "server-only"
import type { Metadata } from "next"
import { localizedPath, type Locale } from "@/i18n/config"

/**
 * Absolute site origin used to build canonical/OG URLs. Must be set in the
 * environment (`NEXT_PUBLIC_SITE_URL`).
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

interface PageMetadataOptions {
  locale: Locale
  /** App path without the locale prefix (e.g. `/patterns`, `/patterns/abc`). */
  path: string
  title: string
  description: string
  /** Absolute URL to an OG/Twitter image (e.g. a pattern thumbnail). */
  image?: string
  /** A wider 1200×630 OG image (defaults to a generated og.png). */
  ogImage?: string
}

/**
 * Build the localized metadata block every page needs: title/description,
 * canonical (locale-specific), hreflang alternates for every supported locale,
 * and Open Graph / Twitter cards.
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  image,
  ogImage,
}: PageMetadataOptions): Metadata {
  const languages: Record<string, string> = {}
  for (const loc of ["en", "zh"] as const) {
    languages[loc] = new URL(localizedPath(loc, path), SITE_URL).toString()
  }

  const canonical = new URL(localizedPath(locale, path), SITE_URL).toString()

  return {
    title,
    description,
    alternates: { canonical, languages },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Pindou",
      locale,
      type: "website",
      images: [ogImage ?? image ?? new URL("/og.png", SITE_URL).toString()],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image ?? ogImage ?? new URL("/og.png", SITE_URL).toString()],
    },
  }
}
