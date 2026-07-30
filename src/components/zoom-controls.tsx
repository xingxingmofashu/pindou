"use client"

import { useRef, useState } from "react"
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
 * Zoom-in / zoom-out / fit buttons with an editable percentage input.
 *
 * Click the percentage to type a value directly: Enter or blur commits it
 * (the canvas hook clamps out-of-range values), Escape cancels the edit.
 */
export function ZoomControls({ zoom, onSetZoom, onFit }: ZoomControlsProps) {
  /** Draft percentage text while editing; `null` when not editing. */
  const [draft, setDraft] = useState<string | null>(null)
  /** Set when Escape cancels an edit, so the pending blur commit is skipped. */
  const cancelRef = useRef(false)

  /**
   * Apply the drafted percentage when it parses to a positive number, then
   * leave editing mode. Empty or non-numeric drafts are discarded.
   */
  const commitDraft = () => {
    if (cancelRef.current) {
      cancelRef.current = false
      setDraft(null)
      return
    }
    if (draft === null) return
    const pct = Number.parseInt(draft.replace(/\D/g, ""), 10)
    if (pct > 0 && pct !== Math.round(zoom * 100)) onSetZoom(pct / 100)
    setDraft(null)
  }

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
      <input
        aria-label="Zoom percentage"
        inputMode="numeric"
        className="w-12 rounded-sm bg-transparent text-center text-xs tabular-nums text-muted-foreground outline-none focus:text-foreground focus:ring-1 focus:ring-ring"
        value={draft ?? `${Math.round(zoom * 100)}%`}
        onFocus={(e) => {
          setDraft(String(Math.round(zoom * 100)))
          e.target.select()
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur()
          } else if (e.key === "Escape") {
            cancelRef.current = true
            e.currentTarget.blur()
          }
        }}
      />
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
