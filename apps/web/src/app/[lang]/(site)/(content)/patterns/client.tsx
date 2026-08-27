"use client"

import { useRouter } from "next/navigation"
import { PatternsPage, type PatternItem } from "@pindou/ui/pages/patterns-page"
import { totalBeadCount } from "@/lib/utils"
import { localizedPath } from "@pindou/core/i18n/config"
import { useI18n } from "@pindou/core/i18n/client"

export interface PatternListItem {
  id: string
  title: string
  authorName: string | null
  beadStats: Record<string, number>
  createdAt: string
  thumbUrl: string
}

/**
 * Thin web wrapper around the shared {@link PatternsPage}: normalizes the
 * server-fetched rows into {@link PatternItem}s, wires the Next.js router for
 * search/clear/navigation, and renders the server-side pagination control.
 */
export function PatternsContentClient({
  q,
  page,
  totalPages,
  total,
  list,
}: {
  q: string
  page: number
  totalPages: number
  total: number
  list: PatternListItem[]
}) {
  const { locale, t } = useI18n()
  const router = useRouter()

  const items: PatternItem[] = list.map((p) => ({
    id: p.id,
    title: p.title,
    thumbUrl: p.thumbUrl || undefined,
    authorName: p.authorName,
    date: p.createdAt,
    beads: totalBeadCount(p.beadStats),
  }))

  return (
    <PatternsPage
      title={t("patterns.title")}
      countLabel={t("patterns.publishedCount", { count: total.toLocaleString() })}
      items={items}
      query={q}
      searchPlaceholder={t("patterns.searchPlaceholder")}
      searchAriaLabel={t("patterns.searchAria")}
      onSearch={(query) =>
        router.push(localizedPath(locale, query ? `/patterns?q=${encodeURIComponent(query)}` : "/patterns"))
      }
      onClearSearch={() => router.push(localizedPath(locale, "/patterns"))}
      onOpen={(id) => router.push(localizedPath(locale, `/patterns/${id}`))}
      emptyTitle={q ? t("patterns.noResults") : t("patterns.empty")}
      emptyActionLabel={q ? undefined : t("patterns.createFirst")}
      onEmptyAction={() => router.push(localizedPath(locale, "/editor"))}
      page={page}
      totalPages={totalPages}
      onPageChange={(target) => {
        const searchSuffix = q ? `&q=${encodeURIComponent(q)}` : ""
        router.push(localizedPath(locale, `/patterns?page=${target}${searchSuffix}`))
      }}
    />
  )
}
