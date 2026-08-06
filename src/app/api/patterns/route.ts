import { NextRequest, NextResponse } from "next/server"
import { desc, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { brands, colors, patterns } from "@/db/schema"
import { generateThumbnail } from "@/lib/thumbnail"
import { PatternInsertSchema, PaginationSchema } from "@/db/schema"
import { auth } from "@/lib/auth"
import type { Palette } from "@/types"

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
      brandCode: brands.code,
      beadStats: patterns.beadStats,
      thumbPng: patterns.thumbPng,
      createdAt: patterns.createdAt,
      total: sql<number>`count(*) over()`.as("total"),
    })
    .from(patterns)
    .innerJoin(brands, eq(patterns.fkBrandId, brands.id))
    .orderBy(desc(patterns.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const total = Number(rows[0]?.total ?? 0)

  return NextResponse.json({
    patterns: rows.map((r) => ({
      id: r.id,
      title: r.title,
      authorName: r.authorName,
      brandCode: r.brandCode,
      beadStats: r.beadStats,
      thumbPng: r.thumbPng,
      createdAt: r.createdAt,
    })),
    pagination: { total, page, pageSize },
  })
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
  const thumbPng = await generateThumbnail(gridData, palette)

  const [inserted] = await db
    .insert(patterns)
    .values({
      title,
      description,
      authorName: session.user.name,
      fkUserId: session.user.id,
      gridData: JSON.stringify(gridData),
      beadStats,
      thumbPng,
      fkBrandId: brand.id,
    })
    .returning({ id: patterns.id })

  return NextResponse.json({ id: inserted.id }, { status: 201 })
}
