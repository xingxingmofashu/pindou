import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { revalidateTag, unstable_cache } from "next/cache"
import { db } from "@/db"
import { brands, colors, patterns } from "@/db/schema"
import { PatternUpdateSchema } from "@/db/schema"
import { auth } from "@/lib/auth/server"
import { Thumbnail } from "@/lib/image/thumbnail"
import { GridStorage } from "@/lib/grid-storage"
import type { Palette } from "@/types"

/** Thumbnail renderer + R2 uploader for this route. */
const thumbnail = new Thumbnail()

/** Grid JSON storage (R2) for this route. */
const grids = new GridStorage()

/**
 * Public pattern data (excluding the session-derived `canEdit`) cached via the
 * data cache — the grid JSON fetch from R2 is the expensive part, so it's
 * cached across requests. The response itself stays dynamic (`force-dynamic` +
 * `private, no-store`) because `canEdit` depends on the requester's session;
 * edits invalidate every pattern entry via {@link revalidateTag} on PATCH,
 * with a 30s time-based fallback.
 */
const getPattern = unstable_cache(
  async (id: string) => {
    const [row] = await db
      .select({
        id: patterns.id,
        title: patterns.title,
        description: patterns.description,
        authorName: patterns.authorName,
        brandCode: brands.code,
        brandId: patterns.fkBrandId,
        gridKey: patterns.gridKey,
        beadStats: patterns.beadStats,
        thumbUrl: patterns.thumbUrl,
        fkUserId: patterns.fkUserId,
        createdAt: patterns.createdAt,
        updatedAt: patterns.updatedAt,
      })
      .from(patterns)
      .innerJoin(brands, eq(patterns.fkBrandId, brands.id))
      .where(eq(patterns.id, id))
    if (!row) return null
    const grid = await grids.get(row.gridKey)
    return { ...row, grid }
  },
  ["pattern"],
  { revalidate: 30, tags: ["pattern"] },
)

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const row = await getPattern(id)

  if (!row) {
    return NextResponse.json({ error: "Pattern not found" }, { status: 404 })
  }

  if (!row.grid) {
    return NextResponse.json({ error: "Pattern grid is missing" }, { status: 500 })
  }

  const session = await auth.api.getSession({ headers: request.headers })

  return NextResponse.json(
    {
      id: row.id,
      title: row.title,
      description: row.description,
      authorName: row.authorName,
      brandCode: row.brandCode,
      brandId: row.brandId,
      gridData: row.grid,
      beadStats: row.beadStats,
      thumbUrl: row.thumbUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      canEdit: Boolean(session && session.user.id === row.fkUserId),
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  )
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: "Sign in to edit" }, { status: 401 })
  }

  const { id } = await params

  const [row] = await db
    .select({
      fkUserId: patterns.fkUserId,
      fkBrandId: patterns.fkBrandId,
      gridKey: patterns.gridKey,
      thumbUrl: patterns.thumbUrl,
    })
    .from(patterns)
    .where(eq(patterns.id, id))
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: "Pattern not found" }, { status: 404 })
  }
  if (row.fkUserId !== session.user.id) {
    return NextResponse.json({ error: "You can only edit your own patterns" }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = PatternUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    )
  }

  const { title, description, gridData, beadStats } = parsed.data

  const [brand] = await db
    .select()
    .from(brands)
    .where(eq(brands.id, row.fkBrandId))
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

  const png = await thumbnail.generate(gridData, palette)
  if (!png) {
    return NextResponse.json({ error: "Empty grid" }, { status: 400 })
  }

  let gridKey = ""
  try {
    gridKey = await grids.upload(id, gridData)
  } catch {
    return NextResponse.json({ error: "Failed to upload grid" }, { status: 503 })
  }

  let thumbUrl: string
  try {
    thumbUrl = await thumbnail.upload(png, id)
  } catch {
    await grids.delete(gridKey).catch(() => {})
    return NextResponse.json({ error: "Failed to upload thumbnail" }, { status: 503 })
  }

  try {
    await db
      .update(patterns)
      .set({
        title,
        description,
        gridKey,
        beadStats,
        thumbUrl,
        updatedAt: new Date(),
      })
      .where(eq(patterns.id, id))
  } catch {
    // Roll back the new grid object; the previously published one (row.gridKey)
    // is untouched because versioned keys never overwrite it.
    await grids.delete(gridKey).catch(() => {})
    await thumbnail.delete(thumbUrl).catch(() => {})
    return NextResponse.json({ error: "Failed to update pattern" }, { status: 500 })
  }

  // Success — the previous grid object is now orphaned; garbage-collect it.
  await grids.delete(row.gridKey).catch(() => {})

  await revalidateTag("pattern", "max")
  await revalidateTag("patterns", "max")

  return NextResponse.json({ id })
}
