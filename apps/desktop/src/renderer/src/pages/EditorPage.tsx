import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import {
  Pencil,
  Eraser,
  PaintBucket,
  Pipette,
  Trash2,
  CaseSensitive,
  ImagePlus,
  Download,
  List,
  Palette as PaletteIcon,
  Save,
  Undo2,
  Redo2,
} from "lucide-react"
import { PixiCanvas, type PixiCanvasApi } from "@pindou/ui/components/pixi-canvas"
import { BeadStatsPanel } from "@pindou/ui/components/bead-stats"
import { ZoomControls } from "@pindou/ui/components/zoom-controls"
import { Button } from "@pindou/ui/components/ui/button"
import { Separator } from "@pindou/ui/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pindou/ui/components/ui/tooltip"
import { toast } from "@pindou/ui/components/ui/toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@pindou/ui/components/ui/alert-dialog"
import { ImportDialog } from "@pindou/ui/components/dialogs/import-dialog"
import { ExportDialog } from "@pindou/ui/components/dialogs/export-dialog"
import { useShortcuts } from "@pindou/core/hooks/use-shortcuts"
import { useEditorStore } from "@pindou/core/hooks/use-editor"
import { useI18n } from "@pindou/core/i18n/client"
import { PALETTES } from "@pindou/shared/palettes"
import { useTheme } from "../theme"
import type { ToolKind, CellsData } from "@pindou/core/editor"
import type { Palette } from "@pindou/shared/types"
import { ColorPalette } from "../components/ColorPalette"
import { SaveDialog } from "../components/SaveDialog"

const TOOLS: { value: ToolKind; icon: typeof Pencil; shortcut: string }[] = [
  { value: "pen", icon: Pencil, shortcut: "B" },
  { value: "eraser", icon: Eraser, shortcut: "E" },
  { value: "fill", icon: PaintBucket, shortcut: "G" },
  { value: "eyedropper", icon: Pipette, shortcut: "I" },
]

/**
 * Desktop editor page. Composes the same shared components as the web editor
 * (PixiCanvas, dialogs, stores), but publishes to the local SQLite store
 * instead of the community API, and has no auth. A `:id` route param opens the
 * pattern for editing; no param starts a fresh canvas.
 */
export default function EditorPage() {
  const { t } = useI18n()
  const { id } = useParams()
  const patternId = id ?? null
  const { isDark } = useTheme()
  const canvasApiRef = useRef<PixiCanvasApi>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [saved, setSaved] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [activePalette, setActivePalette] = useState<Palette>(() => PALETTES[0])
  const [loadedGrid, setLoadedGrid] = useState<string[][] | undefined>(undefined)

  const setApi = useEditorStore((s) => s.setApi)
  const setZoom = useEditorStore((s) => s.setZoom)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)
  const activeTool = useEditorStore((s) => s.activeTool)
  const activeColorIndex = useEditorStore((s) => s.activeColorIndex)
  const setActiveColorIndex = useEditorStore((s) => s.setActiveColorIndex)
  const showLabels = useEditorStore((s) => s.showLabels)
  const showColorPalette = useEditorStore((s) => s.showColorPalette)
  const showBeadStats = useEditorStore((s) => s.showBeadStats)
  const beadStats = useEditorStore((s) => s.beadStats)
  const zoom = useEditorStore((s) => s.zoom)
  const canUndo = useEditorStore((s) => s.canUndo)
  const canRedo = useEditorStore((s) => s.canRedo)
  const api = useEditorStore((s) => s.api)
  const toggleLabels = useEditorStore((s) => s.toggleLabels)
  const toggleBeadStats = useEditorStore((s) => s.toggleBeadStats)
  const toggleColorPalette = useEditorStore((s) => s.toggleColorPalette)

  // Load an existing pattern's grid + meta when editing. The grid is handed to
  // PixiCanvas as a prop so its pinned-grid effect loads it once the canvas
  // initializes (calling api.loadGrid here races the canvas mount).
  useEffect(() => {
    if (!patternId) return
    let cancelled = false
    window.pindou.patterns.get(patternId).then((record) => {
      if (cancelled || !record) return
      setTitle(record.title)
      setDescription(record.description)
      const brand = PALETTES.find((b) => b.id === record.fkBrandId)
      if (brand) setActivePalette(brand)
      setLoadedGrid(record.grid)
    })
    return () => {
      cancelled = true
    }
  }, [patternId])

  // Registers the canvas's imperative API into the shared store so the toolbar
  // and dialogs can drive it. Re-register on palette change — the canvas
  // rebuilds its handle when the palette changes.
  useEffect(() => {
    setApi(canvasApiRef.current)
    return () => setApi(null)
  }, [setApi, activePalette])

  // Stable callbacks for the dialogs.
  const onGetCellsData = useCallback(() => canvasApiRef.current?.getCellsData() ?? null, [])
  const onLoadGrid = useCallback((grid: string[][]) => canvasApiRef.current?.loadGrid(grid), [])
  const onGridChange = useCallback(() => {
    useEditorStore.getState().setBeadStats(canvasApiRef.current?.getBeadStats() ?? null)
    setSaved(false)
  }, [])
  const onHistoryChange = useCallback((u: boolean, r: boolean) => {
    useEditorStore.getState().setHistory(u, r)
  }, [])

  useShortcuts(setActiveTool)

  const handleColorPick = useCallback(
    (index: number) => {
      setActiveColorIndex(index)
      setActiveTool("pen")
    },
    [setActiveColorIndex, setActiveTool],
  )

  // Save: open the dialog to collect title + description, then persist.
  const handleSave = useCallback(() => {
    if (!canvasApiRef.current?.getCellsData()) {
      toast.add({ id: "save-empty", type: "error", title: t("editor.canvasEmpty") })
      return
    }
    setSaveOpen(true)
  }, [t])

  // Persist the canvas grid with the dialog's title/description.
  const handleSaveConfirm = useCallback(
    async (dialogTitle: string, dialogDescription: string) => {
      const data = canvasApiRef.current?.getCellsData()
      if (!data) {
        toast.add({ id: "save-empty", type: "error", title: t("editor.canvasEmpty") })
        setSaveOpen(false)
        return
      }
      try {
        if (patternId) {
          await window.pindou.patterns.update(patternId, {
            title: dialogTitle,
            description: dialogDescription,
            fkBrandId: activePalette.id,
            beadStats: data.beadStats,
            grid: data.grid,
          })
        } else {
          await window.pindou.patterns.create({
            title: dialogTitle,
            description: dialogDescription,
            fkBrandId: activePalette.id,
            beadStats: data.beadStats,
            grid: data.grid,
          })
        }
        setTitle(dialogTitle)
        setDescription(dialogDescription)
        setSaved(true)
        setSaveOpen(false)
        toast.add({ id: "save-ok", type: "success", title: t("desktop.saved") })
      } catch {
        toast.add({ id: "save-fail", type: "error", title: t("desktop.saveFailed") })
      }
    },
    [patternId, activePalette, t],
  )

  // Brand switch: swap the canvas palette and reset to the first colour.
  // usePixiCanvas clears the canvas on brand change.
  const handleBrandChange = useCallback(
    (code: string) => {
      const brand = PALETTES.find((b) => b.code === code)
      if (brand) {
        setActivePalette(brand)
        setActiveColorIndex(1)
      }
    },
    [setActiveColorIndex],
  )

  const createWorker = useCallback(
    () => new Worker(new URL("../worker/transform.worker.ts", import.meta.url), { type: "module" }),
    [],
  )

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <EditorToolbar
        saved={saved}
        dirty={beadStats !== null}
        onSave={handleSave}
        onToggleLabels={toggleLabels}
        showLabels={showLabels}
        onToggleBeadStats={toggleBeadStats}
        showBeadStats={showBeadStats}
        onToggleColorPalette={toggleColorPalette}
        showColorPalette={showColorPalette}
        onOpenImport={() => setImportOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        activeTool={activeTool}
        onSetTool={setActiveTool}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => api?.undo()}
        onRedo={() => api?.redo()}
        onClear={() => api?.clearCanvas()}
        zoom={zoom}
        onSetZoom={(z) => api?.setZoom(z)}
        onFit={() => api?.fitToCanvas()}
      />
      {/* Status bar: pattern title + save state (title/description are
          collected in the save dialog, like the web publish flow). */}
      <div className="flex items-center justify-between gap-2 border px-3 py-1.5">
        <span className="truncate text-xs font-medium">
          {title || t("desktop.untitled")}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {saved ? t("desktop.saved") : beadStats !== null ? t("desktop.unsavedWarning") : " "}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 gap-2">
        {showColorPalette && (
          <div className="w-56 shrink-0 overflow-hidden">
            <ColorPalette
              activeColorIndex={activeColorIndex}
              onColorPick={setActiveColorIndex}
              brands={PALETTES}
              palette={activePalette}
              onBrandChange={handleBrandChange}
            />
          </div>
        )}
        <PixiCanvas
          className="min-h-0 min-w-0 flex-1 border p-2"
          activeTool={activeTool}
          activeColorIndex={activeColorIndex}
          label={showLabels}
          isDark={isDark}
          palette={activePalette}
          grid={loadedGrid}
          apiRef={canvasApiRef}
          onZoomChange={setZoom}
          onGridChange={onGridChange}
          onHistoryChange={onHistoryChange}
          onColorPick={handleColorPick}
        />
        {showBeadStats && (
          <div className="w-56 shrink-0 overflow-hidden">
            <BeadStatsPanel stats={beadStats} palette={activePalette} />
          </div>
        )}
      </div>
      {saveOpen && (
        <SaveDialog
          open={saveOpen}
          onClose={() => setSaveOpen(false)}
          initialTitle={title}
          initialDescription={description}
          onSave={handleSaveConfirm}
        />
      )}
      {importOpen && (
        <ImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onApply={onLoadGrid}
          createWorker={createWorker}
          palette={activePalette}
        />
      )}
      {exportOpen && (
        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          onGetCellsData={onGetCellsData}
          palette={activePalette}
          onSaveBlob={async (blob, defaultName) => {
            await window.pindou.savePng(new Uint8Array(await blob.arrayBuffer()), defaultName)
          }}
        />
      )}
    </div>
  )
}

interface EditorToolbarProps {
  saved: boolean
  dirty: boolean
  onSave: () => void
  onToggleLabels: () => void
  showLabels: boolean
  onToggleBeadStats: () => void
  showBeadStats: boolean
  onToggleColorPalette: () => void
  showColorPalette: boolean
  onOpenImport: () => void
  onOpenExport: () => void
  activeTool: ToolKind
  onSetTool: (tool: ToolKind) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  zoom: number
  onSetZoom: (z: number | ((prev: number) => number)) => void
  onFit: () => void
}

/** Top bar: drawing tools, save button, and zoom controls — mirrors the web
 *  editor's toolbar, with "Save" in place of the web's "Publish". */
function EditorToolbar(props: EditorToolbarProps) {
  const { t } = useI18n()
  const [clearOpen, setClearOpen] = useState(false)

  return (
    <div className="flex items-center justify-between border px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="outline" size="icon-xs" disabled={!props.canUndo} aria-label={t("editor.undo")} onClick={props.onUndo}>
                  <Undo2 data-icon="inline-start" />
                </Button>
              }
            />
            <TooltipContent side="bottom">{t("editor.undo")} (⌘Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="outline" size="icon-xs" disabled={!props.canRedo} aria-label={t("editor.redo")} onClick={props.onRedo}>
                  <Redo2 data-icon="inline-start" />
                </Button>
              }
            />
            <TooltipContent side="bottom">{t("editor.redo")} (⇧⌘Z)</TooltipContent>
          </Tooltip>
          {TOOLS.map(({ value, icon: Icon, shortcut }) => {
            const label = t(`editor.${value}`)
            return (
              <Tooltip key={value}>
                <TooltipTrigger
                  render={
                    <Button
                      variant={props.activeTool === value ? "secondary" : "outline"}
                      size="icon-xs"
                      aria-label={label}
                      onClick={() => props.onSetTool(value)}
                    >
                      <Icon data-icon="inline-start" />
                    </Button>
                  }
                />
                <TooltipContent side="bottom">
                  {label} ({shortcut})
                </TooltipContent>
              </Tooltip>
            )
          })}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant={props.showLabels ? "secondary" : "outline"}
                  size="icon-xs"
                  aria-label={t("editor.showLabels")}
                  onClick={props.onToggleLabels}
                >
                  <CaseSensitive data-icon="inline-start" />
                </Button>
              }
            />
            <TooltipContent side="bottom">{t("editor.labels")}</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant={props.showColorPalette ? "secondary" : "outline"}
                  size="icon-xs"
                  aria-label={t("editor.showColorPaletteToggle")}
                  onClick={props.onToggleColorPalette}
                >
                  <PaletteIcon data-icon="inline-start" />
                </Button>
              }
            />
            <TooltipContent side="bottom">{t("editor.colorPalette")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant={props.showBeadStats ? "secondary" : "outline"}
                  size="icon-xs"
                  aria-label={t("editor.showBeadStatsToggle")}
                  onClick={props.onToggleBeadStats}
                >
                  <List data-icon="inline-start" />
                </Button>
              }
            />
            <TooltipContent side="bottom">{t("editor.beadStats")}</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <AlertDialogTrigger
                    render={
                      <Button variant="outline" size="icon-xs" aria-label={t("editor.clearCanvasAria")}>
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    }
                  />
                }
              />
              <TooltipContent side="bottom">{t("editor.clearCanvas")}</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("editor.clearCanvas")}</AlertDialogTitle>
                <AlertDialogDescription>{t("editor.clearCanvasDescription")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    props.onClear()
                    setClearOpen(false)
                  }}
                >
                  {t("editor.clear")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button size="sm" variant="outline" onClick={props.onOpenImport}>
                <ImagePlus data-icon="inline-start" />
                {t("editor.import")}
              </Button>
            }
          />
          <TooltipContent side="bottom">{t("editor.importFromImage")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button size="sm" variant="outline" onClick={props.onOpenExport}>
                <Download data-icon="inline-start" />
                {t("editor.export")}
              </Button>
            }
          />
          <TooltipContent side="bottom">{t("editor.exportAsPng")}</TooltipContent>
        </Tooltip>
        <Button size="sm" onClick={props.onSave}>
          <Save data-icon="inline-start" />
          {t("desktop.save")}
        </Button>
        <ZoomControls zoom={props.zoom} onSetZoom={props.onSetZoom} onReset={props.onFit} />
      </div>
    </div>
  )
}
