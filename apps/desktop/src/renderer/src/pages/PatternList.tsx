import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus, Search, Trash2 } from "lucide-react"
import { useI18n } from "@pindou/core/i18n/client"
import { parseBeadStats, totalBeadCount } from "@pindou/core/utils"
import { formatRelativeDate } from "@pindou/core/date"
import { Button } from "@pindou/ui/components/ui/button"
import { Card, CardContent } from "@pindou/ui/components/ui/card"
import { Input } from "@pindou/ui/components/ui/input"
import type { Palette } from "@pindou/shared/types"
import type { PatternMeta } from "../../../shared/types"

interface PatternListProps {
  brands: Palette[]
  onOpen: (id: string) => void
  onNew: () => void
}

/** Local pattern gallery: rows from SQLite, new/delete actions, search. */
export default function PatternList({ brands, onOpen, onNew }: PatternListProps) {
  const { locale, t } = useI18n()
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
                const input = new FormData(e.currentTarget).get("q")
                setQuery(typeof input === "string" ? input : "")
              }}
            >
              <div className="relative">
                <Input
                  name="q"
                  defaultValue={query}
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
            <Button size="sm" onClick={onNew}>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery("")
                    // Reset the controlled search input.
                    const input = document.querySelector<HTMLInputElement>('input[name="q"]')
                    if (input) input.value = ""
                  }}
                >
                  {t("patterns.clearSearch")}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={onNew}>
                  <Plus data-icon="inline-start" />
                  {t("desktop.newPattern")}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filtered.map((p) => {
                const brand = brands.find((b) => b.id === p.fkBrandId)
                const colors = brand?.colors ?? []
                const totalBeads = totalBeadCount(parseBeadStats(p.beadStats))
                const relativeDate = formatRelativeDate(p.updatedAt, locale)
                return (
                  <Card
                    key={p.id}
                    className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
                    onClick={() => onOpen(p.id)}
                  >
                    <CardContent className="p-0">
                      <div className="flex h-24 items-stretch overflow-hidden">
                        {colors.slice(0, 8).map((c) => (
                          <div key={c.code} className="flex-1" style={{ backgroundColor: c.hex }} />
                        ))}
                      </div>
                      <div className="p-3">
                        <p className="truncate text-sm font-medium">{p.title || t("desktop.untitled")}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {t("patternCard.beads", { count: totalBeads.toLocaleString() })}
                          <span aria-hidden="true"> · </span>
                          {relativeDate}
                        </p>
                      </div>
                    </CardContent>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label={t("desktop.deletePattern")}
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDelete(p.id)
                      }}
                    >
                      <Trash2 data-icon="inline-start" />
                    </Button>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
