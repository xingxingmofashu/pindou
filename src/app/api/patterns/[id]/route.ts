import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { patterns } from "@/db/schema"
import { PALETTES } from "@/lib/palette/registry"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const [row] = await db
    .select()
    .from(patterns)
    .where(eq(patterns.id, id))

  if (!row) {
    return NextResponse.json({ error: "Pattern not found" }, { status: 404 })
  }

  const palette = PALETTES.get(row.brandId)
  if (!palette) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 404 })
  }

  const grid: number[][] = (() => {
    try {
      return JSON.parse(row.gridData)
    } catch {
      return []
    }
  })()

  return NextResponse.json({
    id: row.id,
    title: row.title,
    description: row.description,
    authorName: row.authorName ?? undefined,
    brandId: row.brandId,
    gridData: grid,
    brandStats: row.beadStats,
    thumbPng: row.thumbPng,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}
