import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { desc, sql } from "drizzle-orm"
import { db } from "@/db"
import { patterns } from "@/db/schema"
import { PALETTES, DEFAULT_PALETTE_ID } from "@/lib/palette/registry"
import { generateThumbnail } from "@/lib/thumbnail"
import { CreatePatternSchema, PaginationSchema } from "@/lib/validation"

export async function GET(request: NextRequest) {
  const { page, pageSize } = PaginationSchema.parse({
    page: request.nextUrl.searchParams.get("page"),
    pageSize: request.nextUrl.searchParams.get("pageSize"),
  })

  const rows = await db
    .select({
      id: patterns.id,
      title: patterns.title,
      authorName: patterns.authorName,
      brandId: patterns.brandId,
      brandStats: patterns.beadStats,
      thumbPng: patterns.thumbPng,
      createdAt: patterns.createdAt,
      total: sql<number>`count(*) over()`.as("total"),
    })
    .from(patterns)
    .orderBy(desc(patterns.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const total = Number(rows[0]?.total ?? 0)

  return NextResponse.json({
    patterns: rows.map((r) => ({
      id: r.id,
      title: r.title,
      authorName: r.authorName ?? undefined,
      brandId: r.brandId,
      brandStats: r.brandStats,
      thumbPng: r.thumbPng,
      createdAt: r.createdAt,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = CreatePatternSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    )
  }

  const { title, description, authorName, gridData, brandId } = parsed.data
  const brand = brandId ?? DEFAULT_PALETTE_ID
  const palette = PALETTES.get(brand)

  const beadStats: Record<string, number> = {}
  for (const row of gridData) {
    for (const cell of row) {
      if (cell === 0) continue
      const color = palette?.colors[cell - 1]
      const code = color?.code ?? String(cell)
      beadStats[code] = (beadStats[code] ?? 0) + 1
    }
  }

  const id = randomUUID()
  const thumbPng = palette ? await generateThumbnail(gridData, palette) : ""
  const now = new Date().toISOString()

  await db.insert(patterns).values({
    id,
    title,
    description: description ?? "",
    authorName: authorName ?? null,
    gridData: JSON.stringify(gridData),
    beadStats: JSON.stringify(beadStats),
    thumbPng,
    brandId: brand,
    createdAt: now,
    updatedAt: now,
  })

  return NextResponse.json({ id }, { status: 201 })
}
