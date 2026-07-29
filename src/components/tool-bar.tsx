"use client"

import { Pencil, Eraser } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

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
}

/**
 * Horizontal toolbar for selecting the active editing tool.
 *
 * Each button shows a tooltip with the tool name and keyboard shortcut.
 */
export function ToolBar({ activeTool, onSelectTool }: ToolBarProps) {
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
    </div>
  )
}
