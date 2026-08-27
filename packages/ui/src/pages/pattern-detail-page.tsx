"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Download, Info, List } from "lucide-react"
import { gridSize } from "@pindou/core/editor"
import { parseBeadStats, totalBeadCount } from "@pindou/core/utils"
import { formatAbsoluteDate, formatRelativeDate } from "@pindou/core/date"
import { usePatternStore } from "@pindou/core/hooks/use-pattern"
import { useI18n } from "@pindou/core/i18n/client"
import { PixiCanvas, type PixiCanvasApi } from "../components/pixi-canvas"
import { ZoomControls } from "../components/zoom-controls"
import { ExportDialog } from "../components/dialogs/export-dialog"
import { Button } from "../components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip"
import type { Palette } from "@pindou/shared/types"

/**
 * Shared read-only pattern detail page (web `/patterns/[id]` + desktop
 * `/patterns/:id`). Receives the full pattern as props and stays framework-
 * agnostic: navigation is injected via `onBack`/`onEdit` callbacks, and the
 * export dialog's save target via `onExportBlob` (desktop saves via IPC; web
 * falls back to the browser download).
 */
export interface PatternDetailPageProps {
  id: string
  title: string
  /** Empty when the pattern has no description. */
  description?: string
  /** Serialized code grid (`grid[row][col]`, "" = empty). */
  grid: string[][]
  /** The pattern's brand palette. */
  palette: Palette
  /** Serialized bead-stats JSON. */
  beadStats: string
  /** Whether the signed-in user may edit (web) / always true (desktop). */
  canEdit?: boolean
  /** Author display name; null/undefined hides the author row (desktop). */
  authorName?: string | null
  createdAt: string
  updatedAt: string
  /** Dark-mode flag; falls back to the shared theme context when omitted. */
  isDark?: boolean
  /** Navigate back to the pattern list (renders a back button when set). */
  onBack?: () => void
  /** Navigate to the edit page (renders the edit button when set + canEdit). */
  onEdit?: () => void
  /** Custom export save target; defaults to a browser download. */
  onExportBlob?: (blob: Blob, defaultName: string) => Promise<void> | void
}

export function PatternDetailPage({
  id,
  title,
  description,
  grid,
  palette,
  beadStats,
  canEdit = false,
  authorName,
  createdAt,
  updatedAt,
  isDark,
  onBack,
  onEdit,
  onExportBlob,
}: PatternDetailPageProps) {
  const { locale, t } = useI18n()
  const canvasApiRef = useRef<PixiCanvasApi>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const setApi = usePatternStore((s) => s.setApi)
  const setZoom = usePatternStore((s) => s.setZoom)
  const showInfoPanel = usePatternStore((s) => s.showInfoPanel)
  const toggleInfoPanel = usePatternStore((s) => s.toggleInfoPanel)
  const showBeadStats = usePatternStore((s) => s.showBeadStats)
  const toggleBeadStats = usePatternStore((s) => s.toggleBeadStats)
  const api = usePatternStore((s) => s.api)
  const zoom = usePatternStore((s) => s.zoom)

  // Registers the canvas's imperative API into the shared store so the
  // toolbar's zoom controls can drive it.
  useEffect(() => {
    setApi(canvasApiRef.current)
    return () => setApi(null)
  }, [setApi])

  const beadStatsParsed = useMemo(() => parseBeadStats(beadStats), [beadStats])
  const { rows = 0, cols = 0 } = gridSize(grid) ?? {}
  const totalBeads = totalBeadCount(beadStatsParsed)

  // Index palette colours by code once, so the per-code lookup below stays O(1).
  const colorByCode = useMemo(() => new Map(palette.colors.map((c) => [c.code, c])), [palette])

  const sortedStats = useMemo(
    () =>
      Object.entries(beadStatsParsed)
        .sort(([, a], [, b]) => b - a)
        .map(([code, count]) => {
          const color = colorByCode.get(code)
          return { code, count, name: color?.name, hex: color?.hex }
        }),
    [beadStatsParsed, colorByCode],
  )

  // Stable: the export dialog memoizes on it, so an identity change per render
  // would defeat the memo.
  const onGetCellsData = useCallback(
    () => ({ grid, brandCode: palette.code, beadStats }),
    [grid, palette.code, beadStats],
  )

  const absoluteDate = formatAbsoluteDate(createdAt, locale, t("patternDetail.dateFormat"))
  const relativeDate = formatRelativeDate(updatedAt, locale)

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2 border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="icon-sm" aria-label={t("desktop.backToList")} onClick={onBack}>
              <ArrowLeft data-icon="inline-start" />
            </Button>
          )}
          <h1 className="min-w-0 truncate text-sm font-semibold">
            {title || t("desktop.untitled")}
          </h1>
        </div>
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
          <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
            <Download data-icon="inline-start" />
            {t("editor.export")}
          </Button>
          {canEdit && onEdit && (
            <Button size="sm" onClick={onEdit}>
              {t("patternDetail.edit")}
            </Button>
          )}
          <ZoomControls
            zoom={zoom}
            onSetZoom={(z) => api?.setZoom(z)}
            onReset={() => api?.fitToCanvas()}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-2">
        {showInfoPanel && (
          <div className="w-56 shrink-0 flex flex-col gap-4 overflow-auto border p-3">
            <div>
              <span className="text-xs text-muted-foreground">{t("patternDetail.grid")}</span>
              <p className="text-sm tabular-nums">
                {cols} × {rows} · {t("patternCard.beads", { count: totalBeads.toLocaleString() })}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">{t("patternDetail.brand")}</span>
              <p className="text-sm">{palette.name}</p>
            </div>
            {authorName !== undefined && (
              <div>
                <span className="text-xs text-muted-foreground">{t("patternDetail.author")}</span>
                <p className="truncate text-sm">{authorName ?? t("patternDetail.anonymous")}</p>
              </div>
            )}
            {relativeDate && (
              <div>
                <span className="text-xs text-muted-foreground">{t("patternDetail.published")}</span>
                <p className="text-sm" title={absoluteDate}>
                  {relativeDate}
                </p>
              </div>
            )}
            {description && <p className="border-t pt-1 text-sm leading-relaxed">{description}</p>}
          </div>
        )}
        <PixiCanvas
          grid={grid}
          palette={palette}
          readonly
          isDark={isDark}
          apiRef={canvasApiRef}
          onZoomChange={setZoom}
          className="min-h-0 min-w-0 flex-1 border"
        />
        {showBeadStats && sortedStats.length > 0 && (
          <div className="w-56 shrink-0 overflow-auto border p-3">
            <h2 className="mb-2 text-sm font-semibold">{t("patternDetail.beadsUsed")}</h2>
            <div className="space-y-1">
              {sortedStats.map(({ code, count, name, hex }) => (
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
          </div>
        )}
      </div>

      {exportOpen && (
        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          onGetCellsData={onGetCellsData}
          palette={palette}
          onSaveBlob={onExportBlob}
        />
      )}
    </div>
  )
}
