import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { db } from "@/db"
import { patterns } from "@/db/schema"
import { Thumbnail } from "@/lib/thumbnail"
import { GridStorage } from "@/lib/grid-storage"
import { PatternInsertSchema, PaginationSchema } from "@/db/schema"
import { getPatternsPage } from "@/lib/server/patterns"
import { getPaletteByCode } from "@/lib/server/palettes"
import { MAX_BODY_BYTES } from "@/lib/constants"
import { auth } from "@/lib/auth/server"

/** Thumbnail renderer + R2 uploader for this route. */
const thumbnail = new Thumbnail()

/** Grid JSON storage (R2) for this route. */
const grids = new GridStorage()

/**
 * The paginated list query lives in `@/lib/server/patterns` (shared with the
 * SSR catalog page) — cached 30s in the data cache per `page`/`pageSize`,
 * invalidated on publish/edit via {@link revalidateTag}. The route stays
 * dynamic because it also serves POST; the `s-maxage` header short-caches the
 * response at the CDN.
 */
export async function GET(request: NextRequest) {
  const { page, pageSize } = PaginationSchema.parse({
    page: request.nextUrl.searchParams.get("page"),
    pageSize: request.nextUrl.searchParams.get("pageSize"),
  })

  // Same 100-char cap as the SSR catalog page so both consumers of the
  // shared cache key agree on the search term.
  const q = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100)

  const { rows, total } = await getPatternsPage(page, pageSize, q || undefined)

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

  const contentLength = Number(request.headers.get("content-length"))
  if (!Number.isNaN(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large (max 20 MB)" }, { status: 413 })
  }

  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large (max 20 MB)" }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = PatternInsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    )
  }

  const { title, description, gridData, brandCode, beadStats } = parsed.data
  const palette = await getPaletteByCode(brandCode)
  if (!palette) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 })
  }

  const patternId = crypto.randomUUID()

  const [thumbPng, gridKey] = await Promise.allSettled([
    thumbnail.generate(gridData, palette),
    grids.upload(patternId, gridData),
  ])

  if (gridKey.status === "rejected") {
    return NextResponse.json({ error: "Failed to upload grid" }, { status: 503 })
  }

  const png = thumbPng.status === "fulfilled" ? thumbPng.value : null
  if (!png) {
    // Roll back the grid object so a failed publish leaves no orphan.
    await grids.delete(gridKey.value).catch(() => {})
    return NextResponse.json(
      { error: thumbPng.status === "rejected" ? "Failed to convert grid" : "Empty grid" },
      { status: thumbPng.status === "rejected" ? 503 : 400 },
    )
  }

  let thumbUrl: string
  try {
    thumbUrl = await thumbnail.upload(png, patternId)
  } catch {
    // Roll back the grid object so a failed publish leaves no orphan.
    await grids.delete(gridKey.value).catch(() => {})
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
        gridKey: gridKey.value,
        beadStats,
        thumbUrl,
        fkBrandId: palette.id,
      })
      .returning({ id: patterns.id })
    await revalidateTag("patterns", "max")
    return NextResponse.json({ id: inserted.id }, { status: 201 })
  } catch {
    // Roll back the uploaded objects so a failed publish leaves no orphans.
    await grids.delete(gridKey.value).catch(() => {})
    await thumbnail.delete(thumbUrl).catch(() => {})
    return NextResponse.json({ error: "Failed to publish pattern" }, { status: 500 })
  }
}
