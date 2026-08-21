import { useCallback, useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { useI18n } from "@pindou/core/i18n/client"
import { Button } from "@pindou/ui/components/ui/button"
import { Card, CardContent } from "@pindou/ui/components/ui/card"
import type { Palette } from "@pindou/shared/types"
import type { PatternMeta } from "../../../shared/types"

interface PatternListProps {
  brands: Palette[]
  onOpen: (id: string) => void
  onNew: () => void
}

/** Local pattern gallery: rows from SQLite, new/delete actions. */
export default function PatternList({ brands, onOpen, onNew }: PatternListProps) {
  const { t } = useI18n()
  const [patterns, setPatterns] = useState<PatternMeta[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    window.pindou.patterns.list().then(setPatterns).finally(() => setLoading(false))
  }, [])

  useEffect(reload, [reload])

  const handleDelete = async (id: string) => {
    await window.pindou.patterns.remove(id)
    reload()
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Pindou</h1>
          <p className="text-xs text-muted-foreground">{t("desktop.patternCount", { count: patterns.length })}</p>
        </div>
        <Button size="sm" onClick={onNew}>
          <Plus data-icon="inline-start" />
          {t("desktop.newPattern")}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : patterns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">{t("desktop.emptyState")}</p>
            <Button variant="outline" size="sm" onClick={onNew}>
              <Plus data-icon="inline-start" />
              {t("desktop.newPattern")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-4">
            {patterns.map((p) => {
              const brand = brands.find((b) => b.code === p.brandCode)
              const colors = brand?.colors ?? []
              return (
                <Card
                  key={p.id}
                  className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
                  onClick={() => onOpen(p.id)}
                >
                  <CardContent className="p-0">
                    <div className="flex h-28 items-stretch overflow-hidden">
                      {colors.slice(0, 8).map((c) => (
                        <div key={c.code} className="flex-1" style={{ backgroundColor: c.hex }} />
                      ))}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-medium">{p.title || t("desktop.untitled")}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {brand?.name ?? p.brandCode} · {new Date(p.updatedAt).toLocaleDateString()}
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
  )
}
