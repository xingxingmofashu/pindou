"use client"

import { ZoomIn, ZoomOut, Maximize } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const ZOOM_STEP = 1.3

interface ZoomControlsProps {
  zoom: number
  onSetZoom: (z: number | ((prev: number) => number)) => void
  onFit: () => void
}

export function ZoomControls({ zoom, onSetZoom, onFit }: ZoomControlsProps) {
  return (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="outline" size="icon-xs">
              <ZoomOut data-icon="inline-start" />
            </Button>
          }
          onClick={() => onSetZoom((prev) => prev / ZOOM_STEP)}
        />
        <TooltipContent side="bottom">Zoom Out</TooltipContent>
      </Tooltip>
      <span className="text-xs tabular-nums w-12 text-center text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="outline" size="icon-xs">
              <ZoomIn data-icon="inline-start" />
            </Button>
          }
          onClick={() => onSetZoom((prev) => prev * ZOOM_STEP)}
        />
        <TooltipContent side="bottom">Zoom In</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="outline" size="icon-xs">
              <Maximize data-icon="inline-start" />
            </Button>
          }
          onClick={onFit}
        />
        <TooltipContent side="bottom">Fit</TooltipContent>
      </Tooltip>
    </div>
  )
}
