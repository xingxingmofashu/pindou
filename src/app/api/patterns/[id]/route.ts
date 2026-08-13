import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { revalidateTag } from "next/cache"
import { db } from "@/db"
import { patterns } from "@/db/schema"
import { PatternUpdateSchema } from "@/db/schema"
import { getPattern } from "@/lib/server/patterns"
import { getPaletteById } from "@/lib/server/palettes"
import { MAX_BODY_BYTES, PATTERN_WRITE_LIMIT, PATTERN_WRITE_WINDOW_MS } from "@/lib/constants"
import { auth } from "@/lib/auth/server"
import { rateLimit } from "@/lib/rate-limit"
import { Thumbnail } from "@/lib/thumbnail"
import { GridStorage } from "@/lib/grid-storage"

/** Thumbnail renderer + R2 uploader for this route. */
const thumbnail = new Thumbnail()

/** Grid JSON storage (R2) for this route. */
const grids = new GridStorage()

/**
 * Public pattern data (excluding the session-derived `canEdit`) is fetched via
 * `@/lib/server/patterns` — the grid JSON from R2 is the expensive part, so
 * it's cached across requests. The response itself stays dynamic
 * (`force-dynamic` + `private, no-store`) because `canEdit` depends on the
 * requester's session; edits invalidate every pattern entry via
 * {@link revalidateTag} on PATCH, with a 30s time-based fallback.
 */
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

  if (!(await rateLimit(`user:${session.user.id}`, PATTERN_WRITE_LIMIT, PATTERN_WRITE_WINDOW_MS))) {
    return NextResponse.json({ error: "Too many requests, try again later" }, { status: 429 })
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

  const parsed = PatternUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    )
  }

  const { title, description, gridData, beadStats } = parsed.data

  const palette = await getPaletteById(row.fkBrandId)
  if (!palette) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 })
  }

  const [png, gridKey] = await Promise.allSettled([
    thumbnail.generate(gridData, palette),
    grids.upload(id, gridData),
  ])

  if (gridKey.status === "rejected") {
    return NextResponse.json({ error: "Failed to upload grid" }, { status: 503 })
  }

  const thumbPng = png.status === "fulfilled" ? png.value : null
  if (!thumbPng) {
    // Roll back the grid object so a failed edit leaves no orphan.
    await grids.delete(gridKey.value).catch(() => {})
    return NextResponse.json(
      { error: png.status === "rejected" ? "Failed to convert grid" : "Empty grid" },
      { status: png.status === "rejected" ? 503 : 400 },
    )
  }

  let thumbUrl: string
  try {
    thumbUrl = await thumbnail.upload(thumbPng, id)
  } catch {
    await grids.delete(gridKey.value).catch(() => {})
    return NextResponse.json({ error: "Failed to upload thumbnail" }, { status: 503 })
  }

  try {
    await db
      .update(patterns)
      .set({
        title,
        description,
        gridKey: gridKey.value,
        beadStats,
        thumbUrl,
        updatedAt: new Date(),
      })
      .where(eq(patterns.id, id))
  } catch {
    // Roll back the new grid/thumbnail objects; the previously published ones
    // (row.gridKey / row.thumbUrl) are untouched because versioned keys never
    // overwrite them.
    await grids.delete(gridKey.value).catch(() => {})
    await thumbnail.delete(thumbUrl).catch(() => {})
    return NextResponse.json({ error: "Failed to update pattern" }, { status: 500 })
  }

  // Success — the previous grid and thumbnail objects are now orphaned; GC them.
  await grids.delete(row.gridKey).catch(() => {})
  await thumbnail.delete(row.thumbUrl).catch(() => {})

  await revalidateTag("pattern", "max")
  await revalidateTag("patterns", "max")

  return NextResponse.json({ id })
}
