"use client"

import { useCallback, useMemo, useState } from "react"
import useSWR from "swr"
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
import { fetcher } from "@/lib/utils"
import { useI18n } from "@/i18n/client"
import { exportGridPng, exportGridSize, DEFAULT_EXPORT_SCALE } from "@/lib/export"
import type { Palette } from "@/types"

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  getCellsData: () => {
    grid: number[][]; brandCode: string; brandId: string; beadStats: string
  } | null
}

/**
 * Export dialog: pick pixels-per-bead, preview the output size, then download
 * the pattern as a PNG chart (grid + coordinates in the header bands).
 */
export function ExportDialog({ open, onClose, getCellsData }: ExportDialogProps) {
  const { t } = useI18n()
  const [scaleInput, setScaleInput] = useState(String(DEFAULT_EXPORT_SCALE))
  // Independent of the toolbar Labels toggle: this controls only the exported
  // image, and the toolbar toggle only controls the canvas. Defaults to on.
  const [labelsOn, setLabelsOn] = useState(true)

  // Snapshot the grid once when the dialog opens — it can't change behind the
  // modal, so re-serializing on every scale keystroke would be wasted work.
  const data = useMemo(() => (open ? getCellsData() : null), [open, getCellsData])
  // Prefetch the pattern's brand palette as soon as the dialog opens so the
  // Export click is instant; the key stays null while closed, so no request.
  const { data: brand } = useSWR<Palette>(
    data ? `/api/brands/${data.brandId}` : null,
    fetcher,
  )
  const grid = data?.grid ?? null
  const rows = grid?.length ?? 0
  const cols = grid?.[0]?.length ?? 0
  const scale = Math.max(1, Math.floor(Number(scaleInput)) || 1)
  const size = grid ? exportGridSize(grid, scale) : null

  const handleExport = useCallback(() => {
    if (!data) {
      toast.add({
        type: "error",
        title: t("editor.canvasEmpty"),
        description: t("editor.canvasEmptyDescription"),
      })
      return
    }
    if (!brand) {
      toast.add({
        type: "error",
        title: t("editor.unknownPalette"),
        description: t("editor.unknownPaletteDescription"),
      })
      return
    }
    exportGridPng(
      data.grid,
      brand,
      scale,
      { showLabels: labelsOn },
    )
    onClose()
  }, [data, brand, scale, labelsOn, onClose, t])

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
