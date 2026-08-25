import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Download, Info, List } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { useI18n } from "@pindou/core/i18n/client"
import { gridSize } from "@pindou/core/editor"
import { parseBeadStats, totalBeadCount } from "@pindou/core/utils"
import { formatAbsoluteDate, formatRelativeDate } from "@pindou/core/date"
import { usePatternStore } from "@pindou/core/hooks/use-pattern"
import { PixiCanvas, type PixiCanvasApi } from "@pindou/ui/components/pixi-canvas"
import { ZoomControls } from "@pindou/ui/components/zoom-controls"
import { ExportDialog } from "@pindou/ui/components/dialogs/export-dialog"
import { Button } from "@pindou/ui/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pindou/ui/components/ui/tooltip"
import { PALETTES } from "@pindou/shared/palettes"
import { useTheme } from "../theme"
import type { PatternRecord } from "../../../shared/types"

/**
 * Read-only pattern viewer — mirrors the web pattern detail page (toolbar,
 * info panel, canvas, bead-usage panel) but loads the record from local
 * SQLite and has no author/community fields.
 */
export default function PatternDetailPage() {
  const { locale, t } = useI18n()
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const canvasApiRef = useRef<PixiCanvasApi>(null)
  const [pattern, setPattern] = useState<PatternRecord | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const setApi = usePatternStore((s) => s.setApi)
  const setZoom = usePatternStore((s) => s.setZoom)
  const showInfoPanel = usePatternStore((s) => s.showInfoPanel)
  const toggleInfoPanel = usePatternStore((s) => s.toggleInfoPanel)
  const showBeadStats = usePatternStore((s) => s.showBeadStats)
  const toggleBeadStats = usePatternStore((s) => s.toggleBeadStats)
  const api = usePatternStore((s) => s.api)
  const zoom = usePatternStore((s) => s.zoom)

  useEffect(() => {
    let cancelled = false
    window.pindou.patterns.get(id).then((record) => {
      if (!cancelled) setPattern(record ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  // Registers the canvas's imperative API into the shared store so the
  // toolbar's zoom controls can drive it.
  useEffect(() => {
    setApi(canvasApiRef.current)
    return () => setApi(null)
  }, [setApi])

  const palette = useMemo(
    () => PALETTES.find((b) => b.id === pattern?.fkBrandId),
    [pattern?.fkBrandId],
  )

  const grid = pattern?.grid
  const beadStats = useMemo(
    () => (pattern ? parseBeadStats(pattern.beadStats) : {}),
    [pattern],
  )
  const size = grid ? gridSize(grid) : undefined
  const { rows = 0, cols = 0 } = size ?? {}
  const totalBeads = totalBeadCount(beadStats)

  const colorByCode = useMemo(
    () => new Map(palette?.colors.map((c) => [c.code, c]) ?? []),
    [palette],
  )

  const sortedStats = useMemo(
    () =>
      Object.entries(beadStats)
        .sort(([, a], [, b]) => b - a)
        .map(([code, count]) => {
          const color = colorByCode.get(code)
          return { code, count, name: color?.name, hex: color?.hex }
        }),
    [beadStats, colorByCode],
  )

  // Stable: the export dialog memoizes on it, so an identity change per render
  // would defeat the memo.
  const onGetCellsData = useCallback(
    () => (grid && palette ? { grid, brandCode: palette.code, beadStats: pattern!.beadStats } : null),
    [grid, palette, pattern],
  )

  if (!pattern || !grid || !palette) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 border p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("patternDetail.loadFailedTitle")}</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/patterns")}>
          {t("desktop.backToList")}
        </Button>
      </div>
    )
  }

  const absoluteDate = formatAbsoluteDate(pattern.createdAt, locale, t("patternDetail.dateFormat"))
  const relativeDate = formatRelativeDate(pattern.updatedAt, locale)

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2 border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label={t("desktop.backToList")} onClick={() => navigate("/patterns")}>
            <ArrowLeft data-icon="inline-start" />
          </Button>
          <h1 className="min-w-0 truncate text-sm font-semibold">{pattern.title || t("desktop.untitled")}</h1>
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
          <Button size="sm" onClick={() => navigate(`/editor/${pattern.id}`)}>
            {t("patternDetail.edit")}
          </Button>
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
            onSaveBlob={async (blob, defaultName) => {
              await window.pindou.savePng(new Uint8Array(await blob.arrayBuffer()), defaultName)
            }}
          />
        )}
      </div>

      <div className="flex min-h-0 flex-1 gap-2">
        {showInfoPanel && (
          <div className="w-56 shrink-0 overflow-auto border p-3">
            <div className="flex flex-col gap-4">
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
              {relativeDate && (
                <div>
                  <span className="text-xs text-muted-foreground">{t("patternDetail.published")}</span>
                  <p className="text-sm" title={absoluteDate}>
                    {relativeDate}
                  </p>
                </div>
              )}
              {pattern.description && (
                <p className="border-t pt-1 text-sm leading-relaxed">{pattern.description}</p>
              )}
            </div>
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
    </div>
  )
}
