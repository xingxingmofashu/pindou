"use client"

import { useMemo } from "react"
import { PALETTES, DEFAULT_PALETTE_ID } from "@/lib/palette/registry"
import { cn } from "@/lib/utils"

interface ColorPaletteProps {
  /**
   * Currently selected palette colour.
   * 0 = eraser / empty cell, 1..N = 1‑based index into `palette.colors`.
   */
  activeColorIndex: number
  /** Called when the user selects a colour (or the eraser). */
  onSelectColor: (index: number) => void
}

/**
 * Scrollable colour palette sidebar panel.
 *
 * Displays all colours from the active bead brand, grouped by series letter,
 * plus an eraser / empty-cell swatch at the top.
 */
export function ColorPalette({ activeColorIndex, onSelectColor }: ColorPaletteProps) {
  const palette = PALETTES.get(DEFAULT_PALETTE_ID)

  /** Colours grouped by series letter, with 1‑based palette indices. */
  const seriesGroups = useMemo(() => {
    if (!palette) return []
    const map = new Map<string, { series: string; colors: { index: number; hex: string; code: string }[] }>()
    palette.colors.forEach((color, i) => {
      const series = color.series ?? "?"
      let group = map.get(series)
      if (!group) {
        group = { series, colors: [] }
        map.set(series, group)
      }
      group.colors.push({ index: i + 1, hex: color.hex, code: color.code })
    })
    return Array.from(map.values())
  }, [palette])

  if (!palette) {
    return (
      <div className="p-3 text-sm text-muted-foreground">
        No palette loaded
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full border">
      <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
        {palette.brand} ({palette.colors.length} colors)
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {/* Eraser / empty-cell swatch */}
        <div>
          <div className="text-[10px] uppercase text-muted-foreground mb-1 px-1">
            Eraser
          </div>
          <button
            type="button"
            className={cn(
              "w-7 h-7 rounded-sm border",
              activeColorIndex === 0
                ? "ring-2 ring-ring ring-offset-1 ring-offset-background"
                : "hover:scale-110 transition-transform"
            )}
            style={{
              background:
                "repeating-linear-gradient(45deg, #ccc 0px, #ccc 2px, #fff 2px, #fff 4px)",
            }}
            onClick={() => onSelectColor(0)}
            aria-label="Eraser (empty cell)"
          />
        </div>

        {/* Series groups */}
        {seriesGroups.map((group) => (
          <div key={group.series}>
            <div className="text-[10px] uppercase text-muted-foreground mb-1 px-1">
              Series {group.series}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(1.5rem,1fr))] gap-2">
              {group.colors.map(({ index, hex, code }) => (
                <button
                  key={index}
                  type="button"
                  className={cn(
                    "w-7 h-7 rounded-sm",
                    activeColorIndex === index
                      ? "ring-2 ring-ring ring-offset-1"
                      : "hover:scale-105 transition-transform"
                  )}
                  style={{ backgroundColor: hex }}
                  onClick={() => onSelectColor(index)}
                  title={`${code} — ${hex}`}
                  aria-label={`Color ${code}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
