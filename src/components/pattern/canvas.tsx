"use client"

import { useRef, useEffect } from "react"
import type { BeadPalette } from "@/types/palette"
import { usePixiCanvas } from "@/hooks/use-pixi-canvas"

interface PatternCanvasProps {
  grid: number[][]
  palette: BeadPalette
  className?: string
}

export function PatternCanvas({ grid, palette, className }: PatternCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { loadGrid } = usePixiCanvas(canvasRef, {
    palette,
    readonly: true,
  })

  useEffect(() => {
    if (grid.length > 0) loadGrid(grid)
  }, [grid, loadGrid])

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="w-full h-full p-2" />
    </div>
  )
}
