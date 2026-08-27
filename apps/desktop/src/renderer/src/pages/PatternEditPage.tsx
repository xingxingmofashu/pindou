import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { PatternEditPage } from "@pindou/ui/pages/pattern-edit-page"
import { useEditStore } from "@pindou/core/hooks/use-edit"
import { toast } from "@pindou/ui/components/ui/toast"
import { useI18n } from "@pindou/core/i18n/client"
import { PALETTES } from "@pindou/shared/palettes"
import type { Palette } from "@pindou/shared/types"

/**
 * Desktop pattern-edit page — thin wrapper around the shared
 * {@link PatternEditPage}: loads the record from SQLite, holds the (switchable)
 * palette state, and wires react-router navigation + the IPC save call.
 */
export default function PatternEditPageWrapper() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [palette, setPalette] = useState<Palette>(() => PALETTES[0])
  const [loadedGrid, setLoadedGrid] = useState<string[][] | undefined>(undefined)
  const [patternFound, setPatternFound] = useState(false)

  // Load the pattern once per id: seed the draft fields and the canvas grid.
  useEffect(() => {
    let cancelled = false
    window.pindou.patterns.get(id).then((record) => {
      if (cancelled) return
      if (!record) return
      setPatternFound(true)
      useEditStore.getState().reset(record.title, record.description)
      const brand = PALETTES.find((b) => b.id === record.fkBrandId)
      if (brand) setPalette(brand)
      setLoadedGrid(record.grid)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  const handleSave = useCallback(
    async (input: { title: string; description: string; beadStats: string; grid: string[][] }) => {
      await window.pindou.patterns.update(id, {
        title: input.title,
        description: input.description,
        fkBrandId: palette.id,
        beadStats: input.beadStats,
        grid: input.grid,
      })
      toast.add({ type: "success", title: t("desktop.saved") })
      navigate(`/patterns/${id}`)
    },
    [id, palette.id, navigate, t],
  )

  if (!patternFound || !loadedGrid) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    )
  }

  return (
    <PatternEditPage
      palette={palette}
      grid={loadedGrid}
      brands={PALETTES}
      onPaletteChange={setPalette}
      onBack={() => navigate(`/patterns/${id}`)}
      onSave={handleSave}
    />
  )
}
