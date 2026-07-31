import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { patterns } from "@/db/schema"
import { PALETTES } from "@/lib/palette/registry"
import { parseBeadStats, totalBeadCount } from "@/lib/utils"
import { PatternDetailClient } from "@/components/pattern/detail-client"
import { formatDistanceToNow, parseISO, isValid } from "date-fns"

export const revalidate = 60

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PatternDetailPage({ params }: PageProps) {
  const { id } = await params

  const row = db
    .select()
    .from(patterns)
    .where(eq(patterns.id, id))
    .get()

  if (!row) notFound()

  const palette = PALETTES.get(row.brandId)
  if (!palette) notFound()

  const beadStats = parseBeadStats(row.beadStats)
  const grid: number[][] = (() => { try { return JSON.parse(row.gridData) } catch { return [] } })()
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const totalBeads = totalBeadCount(beadStats)

  const sortedStats = Object.entries(beadStats)
    .sort(([, a], [, b]) => b - a)
    .map(([code, count]) => {
      const color = palette.colors.find((c) => c.code === code)
      return { code, count, name: color?.name, hex: color?.hex }
    })

  const createdAt = parseISO(row.createdAt)
  const absoluteDate = isValid(createdAt)
    ? createdAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : ""
  const relativeDate = isValid(createdAt)
    ? formatDistanceToNow(createdAt, { addSuffix: true })
    : ""

  return (
    <PatternDetailClient
      grid={grid}
      palette={palette}
      title={row.title}
      description={row.description}
      authorName={row.authorName}
      relativeDate={relativeDate}
      absoluteDate={absoluteDate}
      cols={cols}
      rows={rows}
      totalBeads={totalBeads}
      brand={palette.brand}
      sortedStats={sortedStats}
    />
  )
}
