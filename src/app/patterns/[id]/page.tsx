"use client"

import { useEffect, useState } from "react"
import { useParams, notFound } from "next/navigation"
import { PatternDetailPanel } from "@/components/pattern/detail/panel"
import { PatternDetailToolbar } from "@/components/pattern/detail/toolbar"
import { PixiCanvas } from "@/components/pixi-canvas"
import { PALETTES, DEFAULT_PALETTE_ID } from "@/lib/palette/registry"
import { parseBeadStats, totalBeadCount } from "@/lib/utils"
import { PaletteSchema, type PaletteType } from "@/lib/validation"
import { formatDistanceToNow, parseISO, isValid } from "date-fns"

type Status = "loading" | "ready" | "notfound" | "error"

export default function PatternDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<PaletteType | null>(null)
  const [status, setStatus] = useState<Status>("loading")
  const [prevId, setPrevId] = useState(id)

  if (prevId !== id) {
    setPrevId(id)
    setData(null)
    setStatus("loading")
  }

  useEffect(() => {
    let cancelled = false
    fetch(`/api/patterns/${id}`)
      .then((r) => {
        if (r.status === 404) return null
        if (!r.ok) throw new Error("Request failed")
        return r.json()
      })
      .then((d: unknown) => {
        if (cancelled) return
        if (d === null) {
          setStatus("notfound")
          return
        }
        const result = PaletteSchema.safeParse(d)
        if (result.success) {
          setData(result.data)
          setStatus("ready")
        } else {
          setStatus("error")
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (status === "notfound") notFound()
  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }
  if (status === "error" || !data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Failed to load pattern.</p>
      </div>
    )
  }

  const grid = data.gridData
  const palette =
    PALETTES.get(data.brandId ?? DEFAULT_PALETTE_ID) ??
    PALETTES.get(DEFAULT_PALETTE_ID)!
  const beadStats = parseBeadStats(data.brandStats)
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
    ? createdAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : ""
  const relativeDate = isValid(createdAt)
    ? formatDistanceToNow(createdAt, { addSuffix: true })
    : ""

  return (
    <div className="flex h-full flex-col p-2 gap-2 overflow-hidden">
      <PatternDetailToolbar title={data.title} />
      <div className="flex-1 min-h-0 flex gap-2">
        <PatternDetailPanel
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
