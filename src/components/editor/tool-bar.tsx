"use client"

import { useState } from "react"
import { Pencil, Eraser, Trash2, CaseSensitive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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

/** Identifies one of the drawing tools. */
export type ToolKind = "pen" | "eraser"

const TOOLS: { value: ToolKind; label: string; icon: typeof Pencil; shortcut: string }[] = [
  { value: "pen", label: "Pen", icon: Pencil, shortcut: "B" },
  { value: "eraser", label: "Eraser", icon: Eraser, shortcut: "E" },
]

interface ToolBarProps {
  /** Currently active tool. */
  activeTool: ToolKind
  /** Called when the user switches tools. */
  onSelectTool: (tool: ToolKind) => void
  /** Called when the user clicks the clear-canvas button. */
  onClearCanvas?: () => void
  /** Whether colour codes are shown on the canvas. */
  showLabels?: boolean
  /** Called when the user toggles colour-code labels. */
  onToggleLabels?: () => void
}

/**
 * Horizontal toolbar for selecting the active editing tool.
 *
 * Each button shows a tooltip with the tool name and keyboard shortcut.
 */
export function ToolBar({ activeTool, onSelectTool, onClearCanvas, showLabels, onToggleLabels }: ToolBarProps) {
  const [clearOpen, setClearOpen] = useState(false)

  return (
    <div className="flex items-center gap-0.5">
      {TOOLS.map(({ value, label, icon: Icon, shortcut }) => (
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
      ))}
      {onToggleLabels && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={showLabels ? "secondary" : "outline"}
                size="icon-xs"
                aria-label="Show labels"
              >
                <CaseSensitive data-icon="inline-start" />
              </Button>
            }
            onClick={onToggleLabels}
          />
          <TooltipContent side="bottom">Labels</TooltipContent>
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
                      <Button variant="outline" size="icon-xs" aria-label="Clear canvas">
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    }
                  />
                }
              />
              <TooltipContent side="bottom">Clear Canvas</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Canvas</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all beads. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    onClearCanvas()
                    setClearOpen(false)
                  }}
                >
                  Clear
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  )
}
