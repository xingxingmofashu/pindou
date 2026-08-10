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
import { Export, DEFAULT_EXPORT_SCALE } from "@/lib/export"

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  getCellsData: () => {
    grid: string[][]; brandCode: string; brandId: string; beadStats: string
  } | null
}

/**
 * Export dialog: pick pixels-per-bead, preview the output size, then download
 * the pattern as a PNG chart (grid + coordinates in the header bands).
 */
export function ExportDialog({ open, onClose, getCellsData }: ExportDialogProps) {
  const { t } = useI18n()
  const exporter = useMemo(() => new Export(), [])
  const [scaleInput, setScaleInput] = useState(String(DEFAULT_EXPORT_SCALE))
  // Independent of the toolbar Labels toggle: this controls only the exported
  // image, and the toolbar toggle only controls the canvas. Defaults to on.
  const [labelsOn, setLabelsOn] = useState(true)
  // Whether to append the bead-usage list to the exported PNG. Defaults to on.
  const [beadStatsOn, setBeadStatsOn] = useState(true)

  // Snapshot the grid once when the dialog opens — it can't change behind the
  // modal, so re-serializing on every scale keystroke would be wasted work.
  const data = useMemo(() => (open ? getCellsData() : null), [open, getCellsData])
  // Use the same palette instance the canvas draws with (the active-brand
  // store), so grid indices — 1-based positions in that palette — render
  // identically on export. Fetching a fresh brand here could serve a cached
  // palette whose colour order differs from the canvas's, shifting every bead.
  const { palette } = usePalette()
  const grid = data?.grid ?? null
  const rows = grid?.length ?? 0
  const cols = grid?.[0]?.length ?? 0
  const scale = Math.max(1, Math.floor(Number(scaleInput)) || 1)
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
        beadStatsTitle: t("editor.beadStatsTitle"),
      },
    )
    onClose()
  }, [data, palette, scale, labelsOn, beadStatsOn, exporter, onClose, t])

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
