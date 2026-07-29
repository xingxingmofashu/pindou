"use client"

import { Pencil, Eraser, PaintBucket, Minus, Square, Pipette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { DrawTool } from "@/types/editor"

const TOOLS: { value: DrawTool; label: string; icon: typeof Pencil; shortcut: string }[] = [
  { value: "pen", label: "画笔", icon: Pencil, shortcut: "B" },
  { value: "eraser", label: "橡皮", icon: Eraser, shortcut: "E" },
  { value: "fill", label: "填充", icon: PaintBucket, shortcut: "G" },
  { value: "line", label: "直线", icon: Minus, shortcut: "L" },
  { value: "rect", label: "矩形", icon: Square, shortcut: "R" },
  { value: "eyedropper", label: "吸管", icon: Pipette, shortcut: "I" },
]

interface ToolBarProps {
  activeTool: DrawTool
  onSelectTool: (tool: DrawTool) => void
}

export function ToolBar({ activeTool, onSelectTool }: ToolBarProps) {
  return (
    <div className="flex items-center gap-0.5">
      {TOOLS.map(({ value, label, icon: Icon, shortcut }) => (
        <Tooltip key={value}>
          <TooltipTrigger>
            <Button
              variant={activeTool === value ? "secondary" : "outline"}
              size="icon-xs"
              onClick={() => onSelectTool(value)}
              aria-label={label}
            >
              <Icon data-icon="inline-start" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {label} ({shortcut})
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}
