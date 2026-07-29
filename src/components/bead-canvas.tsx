"use client"

import type { RefObject } from "react"

interface BeadCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  width: number
  height: number
}

export function BeadCanvas({ canvasRef, width, height }: BeadCanvasProps) {
  return (
    <div className="relative flex-1 overflow-hidden rounded-lg border border-border bg-muted/30">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ cursor: "crosshair" }}
        role="img"
        aria-label={`拼豆图纸 ${width}×${height}`}
      />
      <p className="pointer-events-none absolute bottom-2 right-3 text-xs text-muted-foreground">
        {width} × {height}
      </p>
    </div>
  )
}
