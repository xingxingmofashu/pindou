"use client"

import { ZoomControls } from "@/components/editor/zoom-controls"
import { usePatternViewerStore } from "@/hooks/use-pattern-viewer"

/**
 * Zoom controls bound to the pattern viewer canvas via the shared
 * {@link usePatternViewerStore} store. Placed in the page's top bar; the canvas
 * registers its imperative API into the same store.
 */
export function PatternZoomControls() {
  const api = usePatternViewerStore((s) => s.api)
  const zoom = usePatternViewerStore((s) => s.zoom)

  return (
    <ZoomControls
      zoom={zoom}
      onSetZoom={(z) => api?.setZoom(z)}
      onReset={() => api?.fitToCanvas()}
    />
  )
}
