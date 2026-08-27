import { useCallback, useState } from "react"
import { EditorPage } from "@pindou/ui/pages/editor-page"
import { useEditorStore } from "@pindou/core/hooks/use-editor"
import { usePalette } from "@pindou/core/hooks/use-palette"
import { toast } from "@pindou/ui/components/ui/toast"
import { useI18n } from "@pindou/core/i18n/client"
import { PALETTES } from "@pindou/shared/palettes"
import { SaveDialog } from "../components/SaveDialog"

/**
 * Desktop new-pattern editor — thin wrapper around the shared
 * {@link EditorPage}: passes the bundled catalog, wires the local SQLite save
 * flow (SaveDialog → patterns.create) and the desktop image-transform worker.
 */
export default function EditorPageWrapper() {
  const { t } = useI18n()
  const [saveOpen, setSaveOpen] = useState(false)
  const { palette } = usePalette()

  // Persist the canvas grid with the dialog's title/description as a new pattern.
  const handleSaveConfirm = useCallback(
    async (dialogTitle: string, dialogDescription: string) => {
      const data = useEditorStore.getState().api?.getCellsData()
      if (!data) {
        toast.add({ id: "save-empty", type: "error", title: t("editor.canvasEmpty") })
        setSaveOpen(false)
        return
      }
      try {
        await window.pindou.patterns.create({
          title: dialogTitle,
          description: dialogDescription,
          fkBrandId: palette?.id ?? PALETTES[0].id,
          beadStats: data.beadStats,
          grid: data.grid,
        })
        setSaveOpen(false)
        toast.add({ id: "save-ok", type: "success", title: t("desktop.saved") })
      } catch {
        toast.add({ id: "save-fail", type: "error", title: t("desktop.saveFailed") })
      }
    },
    [palette?.id, t],
  )

  // Save: open the dialog to collect title + description, then persist.
  const handleSave = useCallback(() => {
    if (!useEditorStore.getState().api?.getCellsData()) {
      toast.add({ id: "save-empty", type: "error", title: t("editor.canvasEmpty") })
      return
    }
    setSaveOpen(true)
  }, [t])

  const createWorker = useCallback(
    () => new Worker(new URL("../worker/transform.worker.ts", import.meta.url), { type: "module" }),
    [],
  )

  return (
    <EditorPage
      brands={PALETTES}
      primaryLabel={t("desktop.save")}
      onPrimary={handleSave}
      createWorker={createWorker}
    >
      {saveOpen && (
        <SaveDialog
          open={saveOpen}
          onClose={() => setSaveOpen(false)}
          onSave={handleSaveConfirm}
        />
      )}
    </EditorPage>
  )
}
