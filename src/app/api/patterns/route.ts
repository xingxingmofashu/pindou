import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { desc, sql } from "drizzle-orm"
import { db } from "@/db"
import { patterns } from "@/db/schema"
import { PALETTES, DEFAULT_PALETTE_ID } from "@/lib/palette/registry"
import { generateThumbnail } from "@/lib/thumbnail"
import { parseBeadStats } from "@/lib/utils"
import { createPatternSchema, pageSchema } from "@/lib/validation"

const PAGE_SIZE = 24

export async function GET(request: NextRequest) {
  const page = pageSchema.parse(request.nextUrl.searchParams.get("page"))

  const rows = await db
    .select({
      id: patterns.id,
      title: patterns.title,
      brandId: patterns.brandId,
      authorName: patterns.authorName,
      beadStats: patterns.beadStats,
      thumbPng: patterns.thumbPng,
      createdAt: patterns.createdAt,
      total: sql<number>`count(*) over()`.as("total"),
    })
    .from(patterns)
    .orderBy(desc(patterns.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)

  const total = rows[0]?.total ?? 0

  return NextResponse.json({
    patterns: rows.map((r) => ({
      id: r.id,
      title: r.title,
      brandId: r.brandId,
      authorName: r.authorName,
      beadStats: parseBeadStats(r.beadStats),
      thumbPng: r.thumbPng,
      createdAt: r.createdAt,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = createPatternSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    )
  }

  const { title, description, author_name, grid, brand_id } = parsed.data
  const brand = brand_id ?? DEFAULT_PALETTE_ID
  const palette = PALETTES.get(brand)

  const beadStats: Record<string, number> = {}
  for (const row of grid) {
    for (const cell of row) {
      if (cell === 0) continue
      const color = palette?.colors[cell - 1]
      const code = color?.code ?? String(cell)
      beadStats[code] = (beadStats[code] ?? 0) + 1
    }
  }

  const id = randomUUID()
  const thumbPng = palette ? await generateThumbnail(grid, palette) : ""
  const now = new Date().toISOString()

  await db.insert(patterns).values({
    id,
    title,
    description: description ?? "",
    authorName: author_name || null,
    gridData: JSON.stringify(grid),
    beadStats: JSON.stringify(beadStats),
    thumbPng,
    brandId: brand,
    createdAt: now,
    updatedAt: now,
  })

  return NextResponse.json({ id }, { status: 201 })
}
