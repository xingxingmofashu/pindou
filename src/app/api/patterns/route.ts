import { NextRequest, NextResponse } from "next/server"
import { desc, eq, sql } from "drizzle-orm"
import { revalidateTag, unstable_cache } from "next/cache"
import { db } from "@/db"
import { brands, colors, patterns } from "@/db/schema"
import { Thumbnail } from "@/lib/image/thumbnail"
import { GridStorage } from "@/lib/grid-storage"
import { PatternInsertSchema, PaginationSchema } from "@/db/schema"
import { auth } from "@/lib/auth/server"
import type { Palette } from "@/types"

/** Thumbnail renderer + R2 uploader for this route. */
const thumbnail = new Thumbnail()

/** Grid JSON storage (R2) for this route. */
const grids = new GridStorage()

/**
 * The paginated list query is cached in the data cache (30s) per `page` /
 * `pageSize`, and publishing a pattern invalidates it on-demand via
 * {@link revalidateTag}. The route itself stays dynamic because it also serves
 * POST; the `s-maxage` header short-caches the response at the CDN.
 */
const getPatternsPage = unstable_cache(
  async (page: number, pageSize: number) => {
    const rows = await db
      .select({
        id: patterns.id,
        title: patterns.title,
        authorName: patterns.authorName,
        brandCode: brands.code,
        beadStats: patterns.beadStats,
        thumbUrl: patterns.thumbUrl,
        createdAt: patterns.createdAt,
        total: sql<number>`count(*) over()`.as("total"),
      })
      .from(patterns)
      .innerJoin(brands, eq(patterns.fkBrandId, brands.id))
      .orderBy(desc(patterns.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total = Number(rows[0]?.total ?? 0)
    return { rows, total }
  },
  ["patterns"],
  { revalidate: 30, tags: ["patterns"] },
)

export async function GET(request: NextRequest) {
  const { page, pageSize } = PaginationSchema.parse({
    page: request.nextUrl.searchParams.get("page"),
    pageSize: request.nextUrl.searchParams.get("pageSize"),
  })

  const { rows, total } = await getPatternsPage(page, pageSize)

  return NextResponse.json(
    {
      patterns: rows.map((r) => ({
        id: r.id,
        title: r.title,
        authorName: r.authorName,
        brandCode: r.brandCode,
        beadStats: r.beadStats,
        thumbUrl: r.thumbUrl,
        createdAt: r.createdAt,
      })),
      pagination: { total, page, pageSize },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
      },
    },
  )
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: "Sign in to publish" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)

  const parsed = PatternInsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    )
  }

  const { title, description, gridData, brandCode, beadStats } = parsed.data
  const [brand] = await db
    .select()
    .from(brands)
    .where(eq(brands.code, brandCode))
    .limit(1)
  if (!brand) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 })
  }

  const colorRows = await db
    .select()
    .from(colors)
    .where(eq(colors.fkBrandId, brand.id))
    .orderBy(colors.sortOrder)

  const palette: Palette = { ...brand, colors: colorRows }

  const thumbPng = await thumbnail.generate(gridData, palette)
  if (!thumbPng) {
    return NextResponse.json({ error: "Empty grid" }, { status: 400 })
  }

  const patternId = crypto.randomUUID()
  let gridKey = ""
  try {
    gridKey = await grids.upload(patternId, gridData)
  } catch {
    return NextResponse.json({ error: "Failed to upload grid" }, { status: 503 })
  }

  let thumbUrl: string
  try {
    thumbUrl = await thumbnail.upload(thumbPng, patternId)
  } catch {
    // Roll back the grid object so a failed publish leaves no orphan.
    await grids.delete(gridKey).catch(() => {})
    return NextResponse.json({ error: "Failed to upload thumbnail" }, { status: 503 })
  }

  try {
    const [inserted] = await db
      .insert(patterns)
      .values({
        id: patternId,
        title,
        description,
        authorName: session.user.name,
        fkUserId: session.user.id,
        gridKey,
        beadStats,
        thumbUrl,
        fkBrandId: brand.id,
      })
      .returning({ id: patterns.id })
    await revalidateTag("patterns", "max")
    return NextResponse.json({ id: inserted.id }, { status: 201 })
  } catch {
    // Roll back the uploaded objects so a failed publish leaves no orphans.
    await grids.delete(gridKey).catch(() => {})
    await thumbnail.delete(thumbUrl).catch(() => {})
    return NextResponse.json({ error: "Failed to publish pattern" }, { status: 500 })
  }
}
