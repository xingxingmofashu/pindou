"use client"

import { useMemo } from "react"
import type { BeadColor, BeadPalette } from "@/types/palette"
import { cn } from "@/lib/utils"

interface ColorPickerProps {
  palette: BeadPalette
  activeColorId: string | null
  beadStats: Map<string, number>
  onSelectColor: (id: string) => void
}

export function ColorPicker({ palette, activeColorId, beadStats, onSelectColor }: ColorPickerProps) {
  const series = useMemo(() => {
    const map = new Map<string, BeadColor[]>()
    for (const c of palette.colors) {
      const s = c.series ?? "?"
      let list = map.get(s)
      if (!list) { list = []; map.set(s, list) }
      list.push(c)
    }
    return [...map.entries()]
  }, [palette.colors])

  return (
    <div className="flex flex-col gap-1 overflow-auto">
      {series.map(([letter, colors]) => (
        <ColorSeries
          key={letter}
          letter={letter}
          colors={colors}
          activeColorId={activeColorId}
          beadStats={beadStats}
          onSelectColor={onSelectColor}
        />
      ))}
    </div>
  )
}

function ColorSeries({
  letter,
  colors,
  activeColorId,
  beadStats,
  onSelectColor,
}: {
  letter: string
  colors: readonly { id: string; code: string; hex: string }[]
  activeColorId: string | null
  beadStats: Map<string, number>
  onSelectColor: (id: string) => void
}) {
  return (
    <div>
      <div className="px-1 py-0.5 text-xs font-medium text-muted-foreground">{letter}</div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(20px,1fr))] gap-px">
        {colors.map((c) => {
          const count = beadStats.get(c.id)
          const isActive = c.id === activeColorId
          return (
            <button
              key={c.id}
              type="button"
              className={cn(
                "relative size-5 rounded-sm border border-transparent outline-none",
                isActive && "ring-2 ring-ring ring-offset-1 ring-offset-background scale-110 z-10"
              )}
              style={{ backgroundColor: c.hex }}
              title={`${c.code}${count ? ` · ${count}` : ""}`}
              onClick={() => onSelectColor(c.id)}
            >
              {count !== undefined && (
                <span className="absolute -top-1.5 -right-1.5 text-[9px] leading-none rounded-full bg-background text-foreground px-0.5 pointer-events-none">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
