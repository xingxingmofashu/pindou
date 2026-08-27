import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { PatternsPage, type PatternItem } from "@pindou/ui/pages/patterns-page"
import { parseBeadStats, totalBeadCount } from "@pindou/core/utils"
import { useI18n } from "@pindou/core/i18n/client"
import type { PatternMeta } from "../../../shared/types"

/**
 * Local pattern gallery — thin wrapper around the shared {@link PatternsPage}:
 * loads from the SQLite store, filters locally, and wires react-router
 * navigation + the async local thumbnail loader.
 */
export default function PatternsPageWrapper() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [patterns, setPatterns] = useState<PatternMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

  const reload = useCallback(() => {
    window.pindou.patterns.list().then(setPatterns).finally(() => setLoading(false))
  }, [])

  useEffect(reload, [reload])

  const items = useMemo<PatternItem[]>(() => {
    const q = query.trim().toLowerCase()
    return patterns
      .filter(
        (p) => !q || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
      )
      .map((p) => ({
        id: p.id,
        title: p.title,
        date: p.updatedAt,
        beads: totalBeadCount(parseBeadStats(p.beadStats)),
      }))
  }, [patterns, query])

  const getThumbnail = useCallback(
    (id: string) => window.pindou.patterns.thumbnail(id),
    [],
  )

  return (
    <PatternsPage
      title={t("patterns.title")}
      countLabel={t("desktop.patternCount", { count: patterns.length })}
      items={items}
      query={query}
      loading={loading}
      searchPlaceholder={t("patterns.searchPlaceholder")}
      searchAriaLabel={t("patterns.searchAria")}
      onSearch={setQuery}
      onClearSearch={() => setQuery("")}
      onOpen={(id) => navigate(`/patterns/${id}`)}
      getThumbnail={getThumbnail}
      emptyTitle={t("desktop.emptyState")}
      emptyActionLabel={t("patterns.createFirst")}
      onEmptyAction={() => navigate("/editor")}
    />
  )
}
