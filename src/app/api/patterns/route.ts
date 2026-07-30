import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { desc, sql } from "drizzle-orm"
import { db } from "@/db"
import { patterns } from "@/db/schema"
import { MAX_GRID_DIMENSION } from "@/lib/editor/data"
import { PALETTES, DEFAULT_PALETTE_ID } from "@/lib/palette/registry"
import { generateThumbnail } from "@/lib/thumbnail"
import { parseBeadStats } from "@/lib/utils"

const PAGE_SIZE = 24

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get("page")) || 1)

  const rows = db
    .select({
      id: patterns.id,
      title: patterns.title,
      brandId: patterns.brandId,
      authorName: patterns.authorName,
      beadStats: patterns.beadStats,
      createdAt: patterns.createdAt,
      total: sql<number>`count(*) over()`.as("total"),
    })
    .from(patterns)
    .orderBy(desc(patterns.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all()

  const total = rows[0]?.total ?? 0

  return NextResponse.json({
    patterns: rows.map((r) => {
      const { total: _, ...rest } = r
      return { ...rest, beadStats: parseBeadStats(r.beadStats) }
    }),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { title, description, author_name, grid, brand_id } = body as Record<string, unknown>

  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }
  if (title.length > 100) {
    return NextResponse.json({ error: "Title must be ≤100 characters" }, { status: 400 })
  }

  if (description !== undefined && typeof description !== "string") {
    return NextResponse.json({ error: "Invalid description" }, { status: 400 })
  }

  if (author_name !== undefined && typeof author_name !== "string") {
    return NextResponse.json({ error: "Invalid author_name" }, { status: 400 })
  }

  if (!Array.isArray(grid) || grid.length === 0 || grid.length > MAX_GRID_DIMENSION) {
    return NextResponse.json({ error: `Grid rows must be 1–${MAX_GRID_DIMENSION}` }, { status: 400 })
  }

  const colCount = Array.isArray(grid[0]) ? grid[0].length : 0
  if (colCount === 0 || colCount > MAX_GRID_DIMENSION) {
    return NextResponse.json({ error: `Grid columns must be 1–${MAX_GRID_DIMENSION}` }, { status: 400 })
  }

  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== colCount) {
      return NextResponse.json({ error: "Grid must be rectangular" }, { status: 400 })
    }
  }

  if (brand_id !== undefined && typeof brand_id !== "string") {
    return NextResponse.json({ error: "Invalid brand_id" }, { status: 400 })
  }

  const brand = (typeof brand_id === "string" ? brand_id : DEFAULT_PALETTE_ID)
  const palette = PALETTES.get(brand)

  const beadStats: Record<string, number> = {}
  for (const row of grid) {
    for (const cell of row) {
      if (typeof cell !== "number" || cell === 0) continue
      const color = palette?.colors[cell - 1]
      const code = color?.code ?? String(cell)
      beadStats[code] = (beadStats[code] ?? 0) + 1
    }
  }

  const id = randomUUID()
  const thumbPng = palette ? await generateThumbnail(grid, palette) : ""
  const now = new Date().toISOString()

  db.insert(patterns).values({
    id,
    title: title.trim(),
    description: typeof description === "string" ? description.slice(0, 280) : "",
    authorName: typeof author_name === "string" ? author_name.slice(0, 50) || null : null,
    gridData: JSON.stringify(grid),
    beadStats: JSON.stringify(beadStats),
    thumbPng,
    brandId: brand,
    createdAt: now,
    updatedAt: now,
  }).run()

  return NextResponse.json({ id }, { status: 201 })
}
