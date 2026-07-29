"use client"

import { ZoomIn, ZoomOut, Maximize } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface ZoomControlsProps {
  zoom: number
  onSetZoom: (z: number) => void
}

export function ZoomControls({ zoom, onSetZoom }: ZoomControlsProps) {
  return (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => onSetZoom(zoom * 1.3)}
          >
            <ZoomIn data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">放大</TooltipContent>
      </Tooltip>
      <span className="text-xs tabular-nums w-12 text-center text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => onSetZoom(zoom / 1.3)}
          >
            <ZoomOut data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">缩小</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => onSetZoom(8)}
          >
            <Maximize data-icon="inline-start" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">适应</TooltipContent>
      </Tooltip>
    </div>
  )
}
