import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { brands, patterns } from "@/db/schema"

export async function GET(
  _request: Request,
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
      thumbPng: patterns.thumbPng,
      createdAt: patterns.createdAt,
      updatedAt: patterns.updatedAt,
    })
    .from(patterns)
    .innerJoin(brands, eq(patterns.fkBrandId, brands.id))
    .where(eq(patterns.id, id))

  if (!row) {
    return NextResponse.json({ error: "Pattern not found" }, { status: 404 })
  }

  return NextResponse.json({
    id: row.id,
    title: row.title,
    description: row.description,
    authorName: row.authorName,
    brandCode: row.brandCode,
    brandId: row.brandId,
    gridData: JSON.parse(row.gridData),
    beadStats: row.beadStats,
    thumbPng: row.thumbPng,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}
