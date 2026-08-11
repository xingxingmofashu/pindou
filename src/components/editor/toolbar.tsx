"use client"

import { useState } from "react"
import { Pencil, Eraser, PaintBucket, Trash2, CaseSensitive, ImagePlus, Download, List, Undo2, Redo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ZoomControls } from "@/components/editor/zoom-controls"
import { useI18n } from "@/i18n/client"
import type { ToolKind } from "@/lib/editor"
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
} from "@/components/ui/alert-dialog"

const TOOLS: { value: ToolKind; icon: typeof Pencil; shortcut: string }[] = [
  { value: "pen", icon: Pencil, shortcut: "B" },
  { value: "eraser", icon: Eraser, shortcut: "E" },
  { value: "fill", icon: PaintBucket, shortcut: "G" },
]

interface ToolBarProps {
  /** Currently active tool. */
  activeTool: ToolKind
  /** Called when the user switches tools. */
  onSelectTool: (tool: ToolKind) => void
  /** Called when the user clicks the clear-canvas button. */
  onClearCanvas?: () => void
  /** Called when the user clicks the import-from-image button. */
  onImportImage?: () => void
  /** Called when the user clicks the export button (opens the export dialog). */
  onExportImage?: () => void
  /** Whether colour codes are shown on the canvas. */
  showLabels?: boolean
  /** Called when the user toggles colour-code labels. */
  onToggleLabels?: () => void
  /** Whether the bead-usage panel is shown. */
  showBeadStats?: boolean
  /** Called when the user toggles the bead-usage panel. */
  onToggleBeadStats?: () => void
  /** Called when the user clicks the publish button. */
  onPublish: () => void
  /** Current zoom factor (screen pixels per world unit). */
  zoom: number
  /**
   * Set or adjust the zoom level.
   * Accepts an absolute value or an updater function `(prev: number) => number`.
   */
  onSetZoom: (z: number | ((prev: number) => number)) => void
  /** Whether the user can undo/redo the last canvas edit. */
  canUndo?: boolean
  /** Whether the user can redo a previously undone canvas edit. */
  canRedo?: boolean
  /** Called when the user clicks the undo button. */
  onUndo?: () => void
  /** Called when the user clicks the redo button. */
  onRedo?: () => void
  /** Reset zoom to default and centre the view. */
  onReset: () => void
}

/**
 * Editor top bar: drawing tools, publish button, and zoom controls.
 *
 * Each tool button shows a tooltip with the tool name and keyboard shortcut.
 */
export function ToolBar({
  activeTool,
  onSelectTool,
  onClearCanvas,
  onImportImage,
  onExportImage,
  showLabels,
  onToggleLabels,
  showBeadStats,
  onToggleBeadStats,
  onPublish,
  zoom,
  onSetZoom,
  onReset,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: ToolBarProps) {
  const { t } = useI18n()
  const [clearOpen, setClearOpen] = useState(false)

  return (
    <div className="flex items-center justify-between px-3 py-2 border">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          {onUndo && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-xs"
                    disabled={!canUndo}
                    aria-label={t("editor.undo")}
                  >
                    <Undo2 data-icon="inline-start" />
                  </Button>
                }
                onClick={onUndo}
              />
              <TooltipContent side="bottom">
                {t("editor.undo")} (⌘Z)
              </TooltipContent>
            </Tooltip>
          )}
          {onRedo && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-xs"
                    disabled={!canRedo}
                    aria-label={t("editor.redo")}
                  >
                    <Redo2 data-icon="inline-start" />
                  </Button>
                }
                onClick={onRedo}
              />
              <TooltipContent side="bottom">
                {t("editor.redo")} (⇧⌘Z)
              </TooltipContent>
            </Tooltip>
          )}
          {TOOLS.map(({ value, icon: Icon, shortcut }) => {
            const label = t(`editor.${value}`)
            return (
              <Tooltip key={value}>
                <TooltipTrigger
                  render={
                    <Button
                      variant={activeTool === value ? "secondary" : "outline"}
                      size="icon-xs"
                      aria-label={label}
                    >
                      <Icon data-icon="inline-start" />
                    </Button>
                  }
                  onClick={() => onSelectTool(value)}
                />
                <TooltipContent side="bottom">
                  {label} ({shortcut})
                </TooltipContent>
              </Tooltip>
            )
          })}
          {onToggleLabels && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant={showLabels ? "secondary" : "outline"}
                    size="icon-xs"
                    aria-label={t("editor.showLabels")}
                  >
                    <CaseSensitive data-icon="inline-start" />
                  </Button>
                }
                onClick={onToggleLabels}
              />
              <TooltipContent side="bottom">{t("editor.labels")}</TooltipContent>
            </Tooltip>
          )}
          {onToggleBeadStats && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant={showBeadStats ? "secondary" : "outline"}
                    size="icon-xs"
                    aria-label={t("editor.showBeadStatsToggle")}
                  >
                    <List data-icon="inline-start" />
                  </Button>
                }
                onClick={onToggleBeadStats}
              />
              <TooltipContent side="bottom">{t("editor.beadStats")}</TooltipContent>
            </Tooltip>
          )}
          {onClearCanvas && (
            <>
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
                    <AlertDialogDescription>
                      {t("editor.clearCanvasDescription")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        onClearCanvas()
                        setClearOpen(false)
                      }}
                    >
                      {t("editor.clear")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onImportImage && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button size="sm" variant="outline" onClick={onImportImage}>
                  <ImagePlus data-icon="inline-start" />
                  {t("editor.fromImage")}
                </Button>
              }
            />
            <TooltipContent side="bottom">{t("editor.importFromImage")}</TooltipContent>
          </Tooltip>
        )}
        {onExportImage && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button size="sm" variant="outline" onClick={onExportImage}>
                  <Download data-icon="inline-start" />
                  {t("editor.export")}
                </Button>
              }
            />
            <TooltipContent side="bottom">{t("editor.exportAsPng")}</TooltipContent>
          </Tooltip>
        )}
        <Button size="sm" variant="outline" onClick={onPublish}>
          {t("editor.publish")}
        </Button>
        <ZoomControls zoom={zoom} onSetZoom={onSetZoom} onReset={onReset} />
      </div>
    </div>
  )
}
