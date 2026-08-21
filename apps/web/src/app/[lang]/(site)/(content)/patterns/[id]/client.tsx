"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Download, Info, List } from "lucide-react"
import { PixiCanvas, type PixiCanvasApi } from "@/components/pixi-canvas"
import { ZoomControls } from "@/components/zoom-controls"
import { ExportDialog } from "@pindou/ui/dialogs/export-dialog"
import { Button } from "@pindou/ui/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pindou/ui/components/ui/tooltip"
import { parseBeadStats, totalBeadCount } from "@/lib/utils"
import { gridSize } from "@pindou/core/editor"
import { formatAbsoluteDate, formatRelativeDate } from "@pindou/core/date"
import { localizedPath } from "@pindou/core/i18n/config.ts"
import { useI18n } from "@pindou/core/i18n/client.tsx"
import { usePatternStore } from "@pindou/core/hooks/use-pattern"
import type { PatternDetailType } from "@/db/schema"
import type { Palette } from "@pindou/shared/types"

/** Read-only pattern viewer: toolbar, info panel, canvas, and bead-usage panel. */
export function PatternDetailClient({
  id,
  pattern,
  palette,
}: {
  id: string
  pattern: PatternDetailType
  palette: Palette
}) {
  const { locale, t } = useI18n()

  // Registers the canvas's imperative API into the shared store so the
  // toolbar's zoom controls can drive it.
  const canvasApiRef = useRef<PixiCanvasApi>(null)
  const setApi = usePatternStore((s) => s.setApi)
  const setZoom = usePatternStore((s) => s.setZoom)
  const showInfoPanel = usePatternStore((s) => s.showInfoPanel)
  const showBeadStats = usePatternStore((s) => s.showBeadStats)
  useEffect(() => {
    setApi(canvasApiRef.current)
    return () => setApi(null)
  }, [setApi])

  const grid = pattern.gridData
  const beadStats = parseBeadStats(pattern.beadStats)
  const { rows, cols } = gridSize(grid) ?? { rows: 0, cols: 0 }
  const totalBeads = totalBeadCount(beadStats)

  // Index palette colours by code once, so the per-code lookup below stays O(1)
  // instead of scanning the palette for every bead-stat entry.
  const colorByCode = useMemo(() => new Map(palette.colors.map((c) => [c.code, c])), [palette])

  const sortedStats = Object.entries(beadStats)
    .sort(([, a], [, b]) => b - a)
    .map(([code, count]) => {
      const color = colorByCode.get(code)
      return { code, count, name: color?.name, hex: color?.hex }
    })

  const absoluteDate = formatAbsoluteDate(pattern.createdAt, locale, t("patternDetail.dateFormat"))
  const relativeDate = formatRelativeDate(pattern.createdAt, locale)

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <PatternToolbar
        id={id}
        title={pattern.title}
        grid={grid}
        palette={palette}
        beadStats={pattern.beadStats}
        canEdit={pattern.canEdit}
      />
      <div className="flex min-h-0 flex-1 gap-2">
        {showInfoPanel && (
          <PatternInfoPanel
            authorName={pattern.authorName ?? null}
            relativeDate={relativeDate}
            absoluteDate={absoluteDate}
            description={pattern.description || null}
            cols={cols}
            rows={rows}
            totalBeads={totalBeads}
            brand={palette.name}
          />
        )}
        <PixiCanvas
          grid={grid}
          palette={palette}
          readonly
          apiRef={canvasApiRef}
          onZoomChange={setZoom}
          className="min-h-0 min-w-0 flex-1 border"
        />
        {showBeadStats && <PatternBeadStatsPanel sortedStats={sortedStats} />}
      </div>
    </div>
  )
}

/** Top bar: title, export, edit (owner only), and zoom controls. */
function PatternToolbar({
  id,
  title,
  grid,
  palette,
  beadStats,
  canEdit,
}: {
  id: string
  title: string
  grid: string[][]
  palette: Palette
  beadStats: string
  canEdit: boolean
}) {
  const { locale, t } = useI18n()
  const [exportOpen, setExportOpen] = useState(false)
  const api = usePatternStore((s) => s.api)
  const zoom = usePatternStore((s) => s.zoom)
  const showInfoPanel = usePatternStore((s) => s.showInfoPanel)
  const toggleInfoPanel = usePatternStore((s) => s.toggleInfoPanel)
  const showBeadStats = usePatternStore((s) => s.showBeadStats)
  const toggleBeadStats = usePatternStore((s) => s.toggleBeadStats)

  // Stable: the export dialog memoizes on it, so an identity change per render
  // would defeat the memo.
  const onGetCellsData = useCallback(
    () => ({ grid, brandCode: palette.code, beadStats }),
    [grid, palette.code, beadStats],
  )

  return (
    <div className="flex items-center justify-between gap-2 border px-3 py-2">
      <h1 className="min-w-0 truncate text-sm font-semibold">{title}</h1>
      <div className="flex shrink-0 items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={showInfoPanel ? "secondary" : "outline"}
                size="icon-sm"
                aria-label={t("patternDetail.infoPanel")}
              >
                <Info data-icon="inline-start" />
              </Button>
            }
            onClick={toggleInfoPanel}
          />
          <TooltipContent side="bottom">{t("patternDetail.infoPanel")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={showBeadStats ? "secondary" : "outline"}
                size="icon-sm"
                aria-label={t("patternDetail.beadsUsed")}
              >
                <List data-icon="inline-start" />
              </Button>
            }
            onClick={toggleBeadStats}
          />
          <TooltipContent side="bottom">{t("patternDetail.beadsUsed")}</TooltipContent>
        </Tooltip>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setExportOpen(true)}
        >
          <Download data-icon="inline-start" />
          {t("editor.export")}
        </Button>
        {canEdit && (
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href={localizedPath(locale, `/patterns/${id}/edit`)} />}
          >
            {t("patternDetail.edit")}
          </Button>
        )}
        <ZoomControls
          zoom={zoom}
          onSetZoom={(z) => api?.setZoom(z)}
          onReset={() => api?.fitToCanvas()}
        />
      </div>
      {exportOpen && (
        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          onGetCellsData={onGetCellsData}
          palette={palette}
        />
      )}
    </div>
  )
}

/** Left panel: grid dims, brand, author, dates, and description. */
function PatternInfoPanel({
  authorName,
  relativeDate,
  absoluteDate,
  description,
  cols,
  rows,
  totalBeads,
  brand,
}: {
  authorName: string | null
  relativeDate: string
  absoluteDate: string
  description: string | null
  cols: number
  rows: number
  totalBeads: number
  brand: string
}) {
  const { t } = useI18n()

  return (
    <div className="w-56 shrink-0 overflow-auto flex flex-col gap-4 border p-3">
      <div>
        <span className="text-xs text-muted-foreground">{t("patternDetail.grid")}</span>
        <p className="text-sm tabular-nums">
          {cols} × {rows} · {t("patternCard.beads", { count: totalBeads.toLocaleString() })}
        </p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">{t("patternDetail.brand")}</span>
        <p className="text-sm">{brand}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">{t("patternDetail.author")}</span>
        <p className="text-sm truncate">{authorName ?? t("patternDetail.anonymous")}</p>
      </div>
      {relativeDate && (
        <div>
          <span className="text-xs text-muted-foreground">{t("patternDetail.published")}</span>
          <p className="text-sm" title={absoluteDate}>
            {relativeDate}
          </p>
        </div>
      )}
      {description && (
        <p className="text-sm leading-relaxed pt-1 border-t">{description}</p>
      )}
    </div>
  )
}

/** Right panel: per-colour bead usage, ordered by count descending. */
function PatternBeadStatsPanel({
  sortedStats,
}: {
  sortedStats: { code: string; count: number; name?: string; hex?: string }[]
}) {
  const { t } = useI18n()
  if (sortedStats.length === 0) return null

  return (
    <div className="w-56 shrink-0 overflow-auto border p-3">
      <h2 className="mb-2 text-sm font-semibold">{t("patternDetail.beadsUsed")}</h2>
      <div className="space-y-1">
        {sortedStats.map(({ code, count, name, hex }) => (
          <div key={code} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm border"
              style={{ backgroundColor: hex ?? "#ccc" }}
            />
            <span className="truncate flex-1">{name ?? code}</span>
            <span className="text-muted-foreground tabular-nums text-xs">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
