"use client"

import type { BeadPalette } from "@/types/palette"
import { PatternCanvas } from "@/components/pattern/canvas"

interface PatternDetailClientProps {
  grid: number[][]
  palette: BeadPalette
  title: string
  description: string | null
  authorName: string | null
  relativeDate: string
  absoluteDate: string
  cols: number
  rows: number
  totalBeads: number
  brand: string
  sortedStats: { code: string; count: number; name?: string; hex?: string }[]
}

export function PatternDetailClient({
  grid,
  palette,
  title,
  description,
  authorName,
  relativeDate,
  absoluteDate,
  cols,
  rows,
  totalBeads,
  brand,
  sortedStats,
}: PatternDetailClientProps) {
  return (
    <div className="flex h-full flex-col p-2 gap-2 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 border">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-semibold tracking-tight truncate">{title}</h1>
          <span className="text-sm text-muted-foreground shrink-0">
            by {authorName ?? "Anonymous"}
          </span>
          {relativeDate && (
            <span className="text-sm text-muted-foreground shrink-0" title={absoluteDate}>
              {relativeDate}
            </span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 flex gap-2">
        {/* Sidebar: metadata + bead stats */}
        <div className="w-56 shrink-0 overflow-auto flex flex-col gap-4 border p-3">
          <div className="space-y-1.5">
            <div>
              <span className="text-xs text-muted-foreground">Grid</span>
              <p className="text-sm tabular-nums">
                {cols} × {rows} · {totalBeads.toLocaleString()} beads
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Brand</span>
              <p className="text-sm">{brand}</p>
            </div>
            {description && (
              <p className="text-sm leading-relaxed pt-1 border-t">{description}</p>
            )}
          </div>

          {sortedStats.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2">Beads Used</h2>
              <div className="space-y-1">
                {sortedStats.map(({ code, count, name, hex }) => (
                  <div key={code} className="flex items-center gap-2 text-sm">
                    <span
                      className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm border"
                      style={{ backgroundColor: hex ?? "#ccc" }}
                    />
                    <span className="truncate flex-1">{name ?? code}</span>
                    <span className="text-muted-foreground tabular-nums text-xs">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Canvas */}
        <PatternCanvas
          grid={grid}
          palette={palette}
          className="flex-1 min-w-0 border"
        />
      </div>
    </div>
  )
}
