import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { patterns } from "@/db/schema"
import { PALETTES } from "@/lib/palette/registry"
import { parseBeadStats, totalBeadCount } from "@/lib/utils"
import { PatternDetailPanel } from "@/components/pattern/detail-panel"
import { PatternDetailToolbar } from "@/components/pattern/detail-toolbar"
import { PixiCanvas } from "@/components/pixi-canvas"
import { formatDistanceToNow, parseISO, isValid } from "date-fns"

export const revalidate = 60

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PatternDetailPage({ params }: PageProps) {
  const { id } = await params

  const [row] = await db
    .select()
    .from(patterns)
    .where(eq(patterns.id, id))

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
    <div className="flex h-full flex-col p-2 gap-2 overflow-hidden">
      <PatternDetailToolbar title={row.title} />

      {/* Main content */}
      <div className="flex-1 min-h-0 flex gap-2">
        <PatternDetailPanel
          authorName={row.authorName}
          relativeDate={relativeDate}
          absoluteDate={absoluteDate}
          description={row.description}
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
