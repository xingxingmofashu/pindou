import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { brands, colors, patterns } from "@/db/schema"
import { PatternUpdateSchema } from "@/db/schema"
import { auth } from "@/lib/auth/server"
import { Thumbnail } from "@/lib/image/thumbnail"
import type { Palette } from "@/types"

/** Thumbnail renderer + R2 uploader for this route. */
const thumbnail = new Thumbnail()

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const [row] = await db
    .select({
      id: patterns.id,
      title: patterns.title,
      description: patterns.description,
      authorName: patterns.authorName,
      brandCode: brands.code,
      brandId: patterns.fkBrandId,
      gridData: patterns.gridData,
      beadStats: patterns.beadStats,
      thumbUrl: patterns.thumbUrl,
      fkUserId: patterns.fkUserId,
      createdAt: patterns.createdAt,
      updatedAt: patterns.updatedAt,
    })
    .from(patterns)
    .innerJoin(brands, eq(patterns.fkBrandId, brands.id))
    .where(eq(patterns.id, id))

  if (!row) {
    return NextResponse.json({ error: "Pattern not found" }, { status: 404 })
  }

  const session = await auth.api.getSession({ headers: request.headers })

  return NextResponse.json({
    id: row.id,
    title: row.title,
    description: row.description,
    authorName: row.authorName,
    brandCode: row.brandCode,
    brandId: row.brandId,
    gridData: JSON.parse(row.gridData),
    beadStats: row.beadStats,
    thumbUrl: row.thumbUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    canEdit: Boolean(session && session.user.id === row.fkUserId),
  })
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
    .select({ fkUserId: patterns.fkUserId, fkBrandId: patterns.fkBrandId, thumbUrl: patterns.thumbUrl })
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

  let thumbUrl: string
  try {
    thumbUrl = await thumbnail.upload(png, id)
  } catch {
    return NextResponse.json({ error: "Failed to upload thumbnail" }, { status: 503 })
  }

  try {
    await db
      .update(patterns)
      .set({
        title,
        description,
        gridData: JSON.stringify(gridData),
        beadStats,
        thumbUrl,
        updatedAt: new Date(),
      })
      .where(eq(patterns.id, id))
  } catch {
    await thumbnail.delete(thumbUrl).catch(() => {})
    return NextResponse.json({ error: "Failed to update pattern" }, { status: 500 })
  }

  return NextResponse.json({ id })
}
