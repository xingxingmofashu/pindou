"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { PatternDetailPanel } from "@/components/pattern/detail/panel"
import { PixiCanvas } from "@/components/pixi-canvas"
import { parseBeadStats, totalBeadCount } from "@/lib/utils"
import { BrandListSchema, PaletteSchema, type PaletteType } from "@/lib/validation"
import type { Palette } from "@/types"
import { formatDistanceToNow, parseISO, isValid } from "date-fns"

/**
 * Fetch one brand's palette over the wire. Resolves to `undefined` when the
 * brand code is unknown or the request fails.
 */
async function fetchPalette(code: string): Promise<Palette | undefined> {
  try {
    const res = await fetch("/api/brands")
    if (!res.ok) return undefined
    const data = BrandListSchema.parse(await res.json())
    const brand = data.brands.find((b) => b.code === code)
    if (!brand) return undefined
    return { code: brand.code, brand: brand.name, colors: brand.colors }
  } catch {
    return undefined
  }
}

export default function PatternDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<PaletteType>()
  const [palette, setPalette] = useState<Palette>()

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/patterns/${id}`)
      if (!res.ok) throw new Error("Request failed")
      const d: unknown = await res.json()
      const result = PaletteSchema.safeParse(d)
      if (result.success) {
        setData(result.data)
        const pal = await fetchPalette(result.data.brandCode)
        setPalette(pal)
      }
    }
    load()
  }, [id])

  if (!data || !palette) {
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
      const color = palette.colors.find((c) => c.code === code)
      return { code, count, name: color?.name, hex: color?.hex }
    })

  const createdAt = parseISO(data.createdAt)
  const absoluteDate = isValid(createdAt)
    ? createdAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
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
          brand={palette.brand}
          sortedStats={sortedStats}
        />
        <PixiCanvas
          grid={grid}
          palette={palette}
          readonly
          className="flex-1 min-w-0 border"
        />
      </div>
    </div>
  )
}
