"use client"

import useSWR from "swr"
import { useParams } from "next/navigation"
import { PatternDetailPanel } from "@/components/pattern/detail/panel"
import { PixiCanvas } from "@/components/pixi-canvas"
import { fetcher, parseBeadStats, totalBeadCount } from "@/lib/utils"
import type { PaletteSelectType } from "@/db/schema"
import type { Palette } from "@/types"
import { format, formatDistanceToNow, parseISO, isValid } from "date-fns"

export default function PatternDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data } = useSWR<PaletteSelectType>(`/api/patterns/${id}`, fetcher)
  const { data: brand } = useSWR<Palette>(
    data ? `/api/brands/${data.brandId}` : null,
    fetcher,
  )

  if (!data || !brand) {
    return (
      <></>
    )
  }

  const grid = data.gridData
  const beadStats = parseBeadStats(data.beadStats)
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const totalBeads = totalBeadCount(beadStats)

  const sortedStats = Object.entries(beadStats)
    .sort(([, a], [, b]) => b - a)
    .map(([code, count]) => {
      const color = brand.colors.find((c) => c.code === code)
      return { code, count, name: color?.name, hex: color?.hex }
    })

  const createdAt = parseISO(data.createdAt)
  const absoluteDate = isValid(createdAt)
    ? format(createdAt, "MMMM d, yyyy")
    : ""
  const relativeDate = isValid(createdAt)
    ? formatDistanceToNow(createdAt, { addSuffix: true })
    : ""

  return (
    <div className="flex h-full flex-col p-2 gap-2 overflow-hidden">
      <div className="flex-1 min-h-0 flex gap-2">
        <PatternDetailPanel
          title={data.title}
          authorName={data.authorName ?? null}
          relativeDate={relativeDate}
          absoluteDate={absoluteDate}
          description={data.description ?? null}
          cols={cols}
          rows={rows}
          totalBeads={totalBeads}
          brand={brand.name}
          sortedStats={sortedStats}
        />
        <PixiCanvas
          grid={grid}
          palette={brand}
          readonly
          className="flex-1 min-w-0 border"
        />
      </div>
    </div>
  )
}
