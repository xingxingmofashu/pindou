"use client"

import { useRouter } from "next/navigation"
import { localizedPath } from "@pindou/core/i18n/config"
import { useI18n } from "@pindou/core/i18n/client"
import { PatternDetailPage } from "@pindou/ui/pages/pattern-detail-page"
import type { PatternDetailType } from "@/db/schema"
import type { Palette } from "@pindou/shared/types"

/**
 * Thin web wrapper around the shared {@link PatternDetailPage}: wires the
 * Next.js router and localized routes, then delegates everything else.
 */
export function PatternDetailClient({
  id,
  pattern,
  palette,
}: {
  id: string
  pattern: PatternDetailType
  palette: Palette
}) {
  const { locale } = useI18n()
  const router = useRouter()

  return (
    <PatternDetailPage
      id={id}
      title={pattern.title}
      description={pattern.description}
      grid={pattern.gridData}
      palette={palette}
      beadStats={pattern.beadStats}
      canEdit={pattern.canEdit}
      authorName={pattern.authorName}
      createdAt={pattern.createdAt}
      updatedAt={pattern.updatedAt}
      onEdit={() => router.push(localizedPath(locale, `/patterns/${id}/edit`))}
    />
  )
}
