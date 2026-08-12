"use client"

import { useCallback, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import { usePalette } from "@/hooks/use-palette"
import { useI18n } from "@/i18n/client"
import { MAJOR_GRID_STEP } from "@/lib/constants"
import { Export, DEFAULT_EXPORT_SCALE } from "@/lib/export"
import { gridSize, type CellsData } from "@/lib/editor"
import type { Palette } from "@/types"

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  /** Reads the canvas grid — same contract as the API method. */
  onGetCellsData: () => CellsData | null
  /** Pinned palette (pattern editor). Falls back to the active-brand store. */
  palette?: Palette
}

/**
 * Export dialog: pick pixels-per-bead, preview the output size, then download
 * the pattern as a PNG chart (grid + coordinates in the header bands).
 */
export function ExportDialog({ open, onClose, onGetCellsData, palette: pinnedPalette }: ExportDialogProps) {
  const { t } = useI18n()
  const exporter = useMemo(() => new Export(), [])
  const [scaleInput, setScaleInput] = useState(String(DEFAULT_EXPORT_SCALE))
  // Independent of the toolbar Labels toggle: this controls only the exported
  // image, and the toolbar toggle only controls the canvas. Defaults to on.
  const [labelsOn, setLabelsOn] = useState(true)
  // Whether to append the bead-usage list to the exported PNG. Defaults to on.
  const [beadStatsOn, setBeadStatsOn] = useState(true)
  // Whether to draw the major grid (thicker lines every `majorGridStep` cells).
  // Defaults to on so exported charts group the beads into blocks.
  const [majorGridOn, setMajorGridOn] = useState(true)
  // Step (in data cells) of the major grid; defaults to MAJOR_GRID_STEP (8).
  const [majorGridStep, setMajorGridStep] = useState(String(MAJOR_GRID_STEP))

  // Snapshot the grid once when the dialog opens — it can't change behind the
  // modal, so re-serializing on every scale keystroke would be wasted work.
  const data = useMemo(() => (open ? onGetCellsData() : null), [open, onGetCellsData])
  // Use the same palette instance the canvas draws with so grid indices —
  // 1-based positions in that palette — render identically on export. A pinned
  // palette (pattern editor) takes precedence; otherwise read the active-brand
  // store like the main editor does.
  const { palette: storePalette } = usePalette()
  const palette = pinnedPalette ?? storePalette
  const grid = data?.grid ?? null
  const { rows, cols } = (grid ? gridSize(grid) : null) ?? { rows: 0, cols: 0 }
  const scale = Math.max(1, Math.floor(Number(scaleInput)) || 1)
  const majorStep = Math.max(1, Math.floor(Number(majorGridStep)) || MAJOR_GRID_STEP)
  const size = grid ? exporter.size(grid, scale, { showBeadStats: beadStatsOn }) : null

  const handleExport = useCallback(() => {
    if (!data) {
      toast.add({
        type: "error",
        title: t("editor.canvasEmpty"),
        description: t("editor.canvasEmptyDescription"),
      })
      return
    }
    if (!palette) {
      toast.add({
        type: "error",
        title: t("editor.unknownPalette"),
        description: t("editor.unknownPaletteDescription"),
      })
      return
    }
    exporter.png(
      data.grid,
      palette,
      scale,
      {
        showLabels: labelsOn,
        showBeadStats: beadStatsOn,
        showMajorGrid: majorGridOn,
        majorGridStep: majorStep,
        beadStatsTitle: t("editor.beadStatsTitle"),
      },
    )
    onClose()
  }, [data, palette, scale, labelsOn, beadStatsOn, majorGridOn, majorStep, exporter, onClose, t])

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editor.exportTitle")}</DialogTitle>
          <DialogDescription>
            {t("editor.exportDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="export-labels">{t("editor.showColourCodes")}</Label>
          <Switch
            id="export-labels"
            checked={labelsOn}
            onCheckedChange={(checked) => setLabelsOn(checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="export-bead-stats">{t("editor.showBeadStats")}</Label>
          <Switch
            id="export-bead-stats"
            checked={beadStatsOn}
            onCheckedChange={(checked) => setBeadStatsOn(checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="export-major-grid">{t("editor.showMajorGrid")}</Label>
          <Switch
            id="export-major-grid"
            checked={majorGridOn}
            onCheckedChange={(checked) => setMajorGridOn(checked)}
          />
        </div>

        {majorGridOn && (
          <div className="grid gap-1.5">
            <Label htmlFor="export-major-grid-step">{t("editor.majorGridStep")}</Label>
            <Input
              id="export-major-grid-step"
              type="number"
              min={1}
              step={1}
              value={majorGridStep}
              onChange={(e) => setMajorGridStep(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("editor.majorGridHint", { step: majorStep })}
            </p>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="export-scale">{t("editor.pixelsPerBead")}</Label>
          <Input
            id="export-scale"
            type="number"
            min={1}
            step={1}
            value={scaleInput}
            onChange={(e) => setScaleInput(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {rows > 0 && size
              ? [
                  t("editor.exportSize", {
                    cols,
                    rows,
                    width: size.width,
                    height: size.height,
                  }),
                  size.scale < scale
                    ? t("editor.scaleReduced", { scale: size.scale })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : t("editor.scaleHint")}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleExport} disabled={rows === 0}>
            {t("editor.exportPng")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
