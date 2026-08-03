import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { patterns } from "@/db/schema"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const [row] = await db
    .select()
    .from(patterns)
    .where(eq(patterns.id, id))

  if (!row) {
    return NextResponse.json({ error: "Pattern not found" }, { status: 404 })
  }

  return NextResponse.json({
    id: row.id,
    title: row.title,
    description: row.description,
    authorName: row.authorName,
    brandId: row.brandId,
    gridData: JSON.parse(row.gridData),
    beadStats: row.beadStats,
    thumbPng: row.thumbPng,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}
