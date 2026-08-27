import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { PatternsPage, type PatternItem } from "@pindou/ui/pages/patterns-page"
import { parseBeadStats, totalBeadCount } from "@pindou/core/utils"
import { useI18n } from "@pindou/core/i18n/client"
import type { PatternMeta } from "../../../shared/types"

/** Patterns per page for the local gallery. */
const PAGE_SIZE = 20

/**
 * Local pattern gallery — thin wrapper around the shared {@link PatternsPage}:
 * loads a page from the SQLite store (server-side pagination + search over
 * IPC), and wires react-router navigation + the async local thumbnail loader.
 */
export default function PatternsPageWrapper() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [patterns, setPatterns] = useState<PatternMeta[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)

  const reload = useCallback(
    (p: number, q: string) => {
      setLoading(true)
      window.pindou.patterns
        .list(p, PAGE_SIZE, q)
        .then(({ rows, total: t }) => {
          setPatterns(rows)
          setTotal(t)
        })
        .finally(() => setLoading(false))
    },
    [],
  )

  useEffect(() => {
    reload(page, query)
  }, [page, query, reload])

  const items: PatternItem[] = patterns.map((p) => ({
    id: p.id,
    title: p.title,
    date: p.updatedAt,
    beads: totalBeadCount(parseBeadStats(p.beadStats)),
  }))

  const getThumbnail = useCallback((id: string) => window.pindou.patterns.thumbnail(id), [])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <PatternsPage
      title={t("patterns.title")}
      countLabel={t("desktop.patternCount", { count: total })}
      items={items}
      query={query}
      loading={loading}
      searchPlaceholder={t("patterns.searchPlaceholder")}
      searchAriaLabel={t("patterns.searchAria")}
      onSearch={(q) => {
        setQuery(q)
        setPage(1)
      }}
      onClearSearch={() => {
        setQuery("")
        setPage(1)
      }}
      onOpen={(id) => navigate(`/patterns/${id}`)}
      getThumbnail={getThumbnail}
      emptyTitle={query ? t("patterns.noResults") : t("desktop.emptyState")}
      emptyActionLabel={t("patterns.createFirst")}
      onEmptyAction={() => navigate("/editor")}
      page={page}
      totalPages={totalPages}
      onPageChange={setPage}
    />
  )
}
