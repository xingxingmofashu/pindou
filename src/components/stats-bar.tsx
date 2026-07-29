"use client"

import { RotateCcw, RotateCw, Grid3x3, Type, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"

interface StatsBarProps {
  totalBeads: number
  colorKindCount: number
  showGridLines: boolean
  showBeadNumbers: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onToggleGrid: () => void
  onToggleLabels: () => void
  onClear: () => void
}

export function StatsBar({
  totalBeads,
  colorKindCount,
  showGridLines,
  showBeadNumbers,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onToggleGrid,
  onToggleLabels,
  onClear,
}: StatsBarProps) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Tooltip>
        <TooltipTrigger>
          <Button variant="outline" size="icon-xs" disabled={!canUndo} onClick={onUndo}>
            <RotateCcw data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">撤销 (Ctrl+Z)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
          <Button variant="outline" size="icon-xs" disabled={!canRedo} onClick={onRedo}>
            <RotateCw data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">重做 (Ctrl+Y)</TooltipContent>
      </Tooltip>
      <Separator orientation="vertical" className="h-4" />
      <Tooltip>
        <TooltipTrigger>
          <Button variant={showGridLines ? "secondary" : "outline"} size="icon-xs" onClick={onToggleGrid}>
            <Grid3x3 data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">网格线</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
          <Button variant={showBeadNumbers ? "secondary" : "outline"} size="icon-xs" onClick={onToggleLabels}>
            <Type data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">色号标签</TooltipContent>
      </Tooltip>
      <Separator orientation="vertical" className="h-4" />
      <span>
        {totalBeads} 颗豆 · {colorKindCount} 色
      </span>
      <div className="flex-1" />
      <Tooltip>
        <TooltipTrigger>
          <Button variant="outline" size="icon-xs" onClick={onClear}>
            <Trash2 data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">清空画布</TooltipContent>
      </Tooltip>
    </div>
  )
}
