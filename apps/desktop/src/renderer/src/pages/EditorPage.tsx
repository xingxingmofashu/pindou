import { useCallback, useEffect, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
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
import { Input } from "@pindou/ui/components/ui/input"
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
import type { ToolKind, CellsData } from "@pindou/core/editor"
import type { Palette } from "@pindou/shared/types"
import { ColorPalette } from "../components/ColorPalette"

const TOOLS: { value: ToolKind; icon: typeof Pencil; shortcut: string }[] = [
  { value: "pen", icon: Pencil, shortcut: "B" },
  { value: "eraser", icon: Eraser, shortcut: "E" },
  { value: "fill", icon: PaintBucket, shortcut: "G" },
  { value: "eyedropper", icon: Pipette, shortcut: "I" },
]

interface EditorPageProps {
  /** Pattern being edited, or null for a new pattern. */
  patternId: string | null
  /** Full local catalog (loaded once by App). */
  brands: Palette[]
  /** Dark-mode flag for the canvas (theme is owned by the App shell). */
  isDark: boolean
}

/**
 * Desktop editor page. Composes the same shared components as the web editor
 * (PixiCanvas, dialogs, stores), but publishes to the local SQLite store
 * instead of the community API, and has no auth.
 */
export default function EditorPage({ patternId, brands, isDark }: EditorPageProps) {
  const { t } = useI18n()
  const canvasApiRef = useRef<PixiCanvasApi>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [saved, setSaved] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [activePalette, setActivePalette] = useState<Palette>(() => brands[0])

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

  // Load an existing pattern's grid + meta when editing.
  useEffect(() => {
    if (!patternId) return
    let cancelled = false
    window.pindou.patterns.get(patternId).then((record) => {
      if (cancelled || !record) return
      setTitle(record.title)
      setDescription(record.description)
      const brand = brands.find((b) => b.id === record.fkBrandId)
      if (brand) setActivePalette(brand)
      canvasApiRef.current?.loadGrid(record.grid)
    })
    return () => {
      cancelled = true
    }
  }, [patternId, brands])

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

  // Save: serialize the canvas grid and write it to the local store.
  const handleSave = useCallback(async () => {
    const data = canvasApiRef.current?.getCellsData()
    if (!data) {
      toast.add({ id: "save-empty", type: "error", title: t("editor.canvasEmpty") })
      return
    }
    try {
      if (patternId) {
        await window.pindou.patterns.update(patternId, {
          title,
          description,
          fkBrandId: activePalette.id,
          beadStats: data.beadStats,
          grid: data.grid,
        })
      } else {
        await window.pindou.patterns.create({
          title,
          description,
          fkBrandId: activePalette.id,
          beadStats: data.beadStats,
          grid: data.grid,
        })
      }
      setSaved(true)
      toast.add({ id: "save-ok", type: "success", title: t("desktop.saved") })
    } catch {
      toast.add({ id: "save-fail", type: "error", title: t("desktop.saveFailed") })
    }
  }, [patternId, title, description, activePalette, t])

  // Brand switch: swap the canvas palette and reset to the first colour.
  // usePixiCanvas clears the canvas on brand change.
  const handleBrandChange = useCallback(
    (code: string) => {
      const brand = brands.find((b) => b.code === code)
      if (brand) {
        setActivePalette(brand)
        setActiveColorIndex(1)
      }
    },
    [brands, setActiveColorIndex],
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
      <div className="flex items-center gap-2 border px-3 py-1.5">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("desktop.titlePlaceholder")}
          aria-label={t("desktop.title")}
          className="h-7 w-48"
        />
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("desktop.descriptionPlaceholder")}
          aria-label={t("desktop.descriptionPlaceholder")}
          className="h-7 min-w-0 flex-1"
        />
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
              brands={brands}
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
          apiRef={canvasApiRef}
          onZoomChange={setZoom}
          onGridChange={onGridChange}
          onHistoryChange={onHistoryChange}
          onColorPick={handleColorPick}
        />
        {showBeadStats && (
          <div className="w-56 shrink-0 overflow-hidden">
            <BeadStatsPanel stats={beadStats} />
          </div>
        )}
      </div>
      {importOpen && (
        <ImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onApply={onLoadGrid}
          createWorker={createWorker}
        />
      )}
      {exportOpen && (
        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          onGetCellsData={onGetCellsData}
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
