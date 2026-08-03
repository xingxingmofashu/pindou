"use client"

import { ZoomIn, ZoomOut, Maximize } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/** Multiplicative step for the zoom-in / zoom-out buttons. */
const ZOOM_STEP = 1.3

interface ZoomControlsProps {
  /** Current zoom factor (screen pixels per world unit). */
  zoom: number
  /**
   * Set or adjust the zoom level.
   * Accepts an absolute value or an updater function `(prev: number) => number`.
   */
  onSetZoom: (z: number | ((prev: number) => number)) => void
  /** Reset zoom to default and centre the view. */
  onFit: () => void
}

/**
 * Zoom-in / zoom-out / fit buttons with a read-only percentage readout.
 */
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
      <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
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
