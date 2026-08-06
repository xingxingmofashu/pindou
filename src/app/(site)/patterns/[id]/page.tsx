"use client"

import { useEffect } from "react"
import useSWR from "swr"
import { useParams } from "next/navigation"
import { PatternDetailPanel } from "@/components/pattern/detail/panel"
import { PixiCanvas } from "@/components/pixi-canvas"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { fetcher, parseBeadStats, totalBeadCount } from "@/lib/utils"
import type { PaletteSelectType } from "@/db/schema"
import type { Palette } from "@/types"
import { format, formatDistanceToNow, parseISO, isValid } from "date-fns"

export default function PatternDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, error, isValidating, mutate } = useSWR<PaletteSelectType>(
    `/api/patterns/${id}`,
    fetcher,
  )
  const {
    data: brand,
    error: brandError,
    isValidating: brandValidating,
    mutate: mutateBrand,
  } = useSWR<Palette>(data ? `/api/brands/${data.brandId}` : null, fetcher)

  useEffect(() => {
    if (error && !isValidating) {
      toast.add({
        id: "pattern-load-failed",
        type: "error",
        title: "Failed to load pattern",
        description: "This pattern could not be loaded.",
        actionProps: {
          children: "Retry",
          onClick: () => mutate(),
        },
      })
      return
    }
    if (brandError && !brandValidating) {
      toast.add({
        id: "brand-load-failed",
        type: "error",
        title: "Failed to load palette",
        description: "This pattern's palette could not be loaded.",
        actionProps: {
          children: "Retry",
          onClick: () => mutateBrand(),
        },
      })
    }
  }, [error, isValidating, brandError, brandValidating, mutate, mutateBrand])

  if (error || brandError) return null

  if (!data || !brand) {
    return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
        <div className="flex-1 min-h-0 flex gap-2">
          <div className="w-56 shrink-0 flex flex-col gap-4 border p-3">
            <Skeleton className="h-5 w-3/4" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <Skeleton className="flex-1 min-w-0 rounded-none border" />
        </div>
      </div>
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
