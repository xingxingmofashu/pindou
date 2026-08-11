"use client"

import { useCallback, useState } from "react"
import { Download } from "lucide-react"
import { ExportDialog } from "@/components/editor/export-dialog"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n/client"
import type { Palette } from "@/types"

/**
 * Export-as-PNG button for the read-only pattern detail page. The page is a
 * server component with the grid already resolved, so this passes that static
 * snapshot (grid + brand code + bead stats) straight to the export dialog —
 * there is no live canvas to read from.
 */
export function PatternExportButton({
  grid,
  palette,
  beadStats,
}: {
  grid: string[][]
  palette: Palette
  beadStats: string
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  const onGetCellsData = useCallback(
    () => ({ grid, brandCode: palette.code, beadStats }),
    [grid, palette.code, beadStats],
  )

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={t("editor.exportAsPng")}
      >
        <Download data-icon="inline-start" />
        {t("editor.exportAsPng")}
      </Button>
      {open && (
        <ExportDialog open={open} onClose={() => setOpen(false)} onGetCellsData={onGetCellsData} palette={palette} />
      )}
    </>
  )
}
