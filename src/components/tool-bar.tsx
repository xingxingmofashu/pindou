"use client"

import { Pencil, Eraser, PaintBucket, Pipette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export type ToolKind = "pen" | "eraser" | "fill" | "eyedropper"

const TOOLS: { value: ToolKind; label: string; icon: typeof Pencil; shortcut: string }[] = [
  { value: "pen", label: "Pen", icon: Pencil, shortcut: "B" },
  { value: "eraser", label: "Eraser", icon: Eraser, shortcut: "E" },
  { value: "fill", label: "Fill", icon: PaintBucket, shortcut: "G" },
  { value: "eyedropper", label: "Eyedropper", icon: Pipette, shortcut: "I" },
]

interface ToolBarProps {
  activeTool: ToolKind
  onSelectTool: (tool: ToolKind) => void
}

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
