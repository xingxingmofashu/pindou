"use client"

import { ZoomIn, ZoomOut, Maximize } from "lucide-react"
import { ZOOM_STEP } from "@pindou/shared/constants"
import { Button } from "./ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"
import { useI18n } from "@pindou/core/i18n/client.tsx"

interface ZoomControlsProps {
  /** Current zoom factor (screen pixels per world unit). */
  zoom: number
  /**
   * Set or adjust the zoom level.
   * Accepts an absolute value or an updater function `(prev: number) => number`.
   */
  onSetZoom: (z: number | ((prev: number) => number)) => void
  /** Reset zoom to default and centre the view. */
  onReset: () => void
}

/**
 * Zoom-in / zoom-out / fit buttons with a read-only percentage readout.
 */
export function ZoomControls({ zoom, onSetZoom, onReset: onFit }: ZoomControlsProps) {
  const { t } = useI18n()
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
        <TooltipContent side="bottom">{t("editor.zoomOut")}</TooltipContent>
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
        <TooltipContent side="bottom">{t("editor.zoomIn")}</TooltipContent>
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
        <TooltipContent side="bottom">{t("editor.fit")}</TooltipContent>
      </Tooltip>
    </div>
  )
}
