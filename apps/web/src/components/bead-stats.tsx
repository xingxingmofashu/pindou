"use client"

import { useMemo } from "react"
import { useI18n } from "@pindou/core/i18n/client"
import { usePalette } from "@pindou/core/hooks/use-palette"
import type { BeadStats } from "@pindou/core/editor"
import type { Palette } from "@pindou/core/types"

/**
 * Live bead-usage panel for the editor's right sidebar: the painted grid size,
 * the total bead count, and one row per used colour (swatch, name, count)
 * ordered by count descending.
 *
 * `stats` is owned by the editor page and recomputed by the canvas whenever the
 * grid changes (stroke end, fill, clear, import) — the panel only resolves each
 * code against the active palette and renders.
 *
 * When `palette` is pinned (pattern editor), it is used directly; otherwise the
 * active-brand store is read.
 */
export function BeadStatsPanel({ stats, palette: pinnedPalette }: { stats: BeadStats | null; palette?: Palette }) {
  const { t } = useI18n()
  const { palette: storePalette } = usePalette()
  const palette = pinnedPalette ?? storePalette

  const rows = useMemo(() => {
    if (!stats) return null
    // Resolve code → colour once; colours absent from the palette fall back to
    // showing the bare code with a neutral swatch.
    const colorByCode = new Map((palette?.colors ?? []).map((c) => [c.code, c]))
    const order = new Map((palette?.colors ?? []).map((c, i) => [c.code, i]))
    return [...stats.rows]
      .sort((a, b) => b.count - a.count || (order.get(a.code) ?? Infinity) - (order.get(b.code) ?? Infinity))
      .map(({ code, count }) => {
        const color = colorByCode.get(code)
        return { code, count, name: color?.name, hex: color?.hex }
      })
  }, [stats, palette])

  return (
    <div className="flex h-full flex-col border p-3">
      <h2 className="mb-2 text-sm font-semibold">{t("patternDetail.beadsUsed")}</h2>
      {stats && rows ? (
        <>
          <p className="mb-2 text-sm tabular-nums text-muted-foreground">
            {stats.width} × {stats.height} ·{" "}
            {t("patternCard.beads", { count: stats.total.toLocaleString() })}
          </p>
          <div className="min-h-0 flex-1 space-y-1 overflow-auto">
            {rows.map(({ code, count, name, hex }) => (
              <div key={code} className="flex items-center gap-2 text-sm">
                <span
                  className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm border"
                  style={{ backgroundColor: hex ?? "#ccc" }}
                />
                <span className="flex-1 truncate">{name ?? code}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{t("editor.canvasEmpty")}</p>
      )}
    </div>
  )
}
