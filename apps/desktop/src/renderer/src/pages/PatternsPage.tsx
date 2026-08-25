import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus, Search, Trash2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useI18n } from "@pindou/core/i18n/client"
import { parseBeadStats, totalBeadCount } from "@pindou/core/utils"
import { formatRelativeDate } from "@pindou/core/date"
import { Button } from "@pindou/ui/components/ui/button"
import { Card, CardHeader, CardTitle } from "@pindou/ui/components/ui/card"
import { Input } from "@pindou/ui/components/ui/input"
import type { PatternMeta } from "../../../shared/types"

/** 1×1 transparent GIF — placeholder `src` for a failed/empty thumbnail. */
const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"

/** Local pattern gallery — the desktop analogue of the web catalog page
 *  (apps/web/src/app/[lang]/(site)/(content)/patterns/client.tsx): same card
 *  layout, search box, and empty states, backed by the SQLite store. */
export default function PatternsPage() {
  const { locale, t } = useI18n()
  const navigate = useNavigate()
  const [patterns, setPatterns] = useState<PatternMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

  const reload = useCallback(() => {
    window.pindou.patterns.list().then(setPatterns).finally(() => setLoading(false))
  }, [])

  useEffect(reload, [reload])

  const handleDelete = async (id: string) => {
    await window.pindou.patterns.remove(id)
    reload()
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return patterns
    return patterns.filter(
      (p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
    )
  }, [patterns, query])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col border">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <h1 className="text-sm font-semibold">{t("patterns.title")}</h1>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground">
              {t("desktop.patternCount", { count: patterns.length })}
            </p>
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault()
                setQuery(query.trim())
              }}
            >
              <div className="relative">
                <Input
                  name="q"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("patterns.searchPlaceholder")}
                  aria-label={t("patterns.searchAria")}
                  className="h-8 w-40 pr-8 sm:w-48"
                />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  aria-label={t("patterns.searchAria")}
                  className="absolute right-0 top-0 text-muted-foreground hover:text-foreground"
                >
                  <Search />
                </Button>
              </div>
            </form>
            <Button size="sm" onClick={() => navigate("/editor")}>
              <Plus data-icon="inline-start" />
              {t("desktop.newPattern")}
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">
                {query ? t("patterns.noResults") : t("desktop.emptyState")}
              </p>
              {query ? (
                <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                  {t("patterns.clearSearch")}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => navigate("/editor")}>
                  <Plus data-icon="inline-start" />
                  {t("desktop.newPattern")}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filtered.map((p) => (
                <PatternCard key={p.id} pattern={p} locale={locale} t={t} onDelete={() => handleDelete(p.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** One gallery entry — mirrors the web PatternCard: flush thumbnail, title,
 *  bead count, and relative date. Desktop additions: the card opens the
 *  pattern directly and a hover-revealed delete button removes it locally. */
function PatternCard({
  pattern,
  locale,
  t,
  onDelete,
}: {
  pattern: PatternMeta
  locale: string
  t: (path: string, vars?: Record<string, string | number>) => string
  onDelete: () => void
}) {
  const navigate = useNavigate()
  const totalBeads = totalBeadCount(parseBeadStats(pattern.beadStats))
  const relativeDate = formatRelativeDate(pattern.updatedAt, locale)
  const [thumbSrc, setThumbSrc] = useState<string | null>(null)
  const [thumbFailed, setThumbFailed] = useState(false)

  useEffect(() => {
    window.pindou.patterns.thumbnail(pattern.id).then(setThumbSrc)
  }, [pattern.id])

  return (
    <Card
      className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
      onClick={() => navigate(`/patterns/${pattern.id}`)}
    >
      <img
        src={thumbSrc && !thumbFailed ? thumbSrc : TRANSPARENT_PIXEL}
        alt=""
        className="block aspect-square w-full bg-muted object-cover [image-rendering:pixelated]"
        onError={() => setThumbFailed(true)}
      />
      <CardHeader>
        <CardTitle className="truncate">{pattern.title || t("desktop.untitled")}</CardTitle>
        <p className="truncate text-xs text-muted-foreground">
          {t("patternCard.beads", { count: totalBeads.toLocaleString() })}
          <span aria-hidden="true"> · </span>
          {relativeDate}
        </p>
      </CardHeader>
      <Button
        variant="ghost"
        size="icon-xs"
        className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
        aria-label={t("desktop.deletePattern")}
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
      >
        <Trash2 data-icon="inline-start" />
      </Button>
    </Card>
  )
}
