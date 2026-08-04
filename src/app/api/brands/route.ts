import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { brands, colors } from "@/db/schema"

export const runtime = "nodejs"

/**
 * GET /api/brands — every brand with its colors nested (the client catalog).
 * A single left join yields flat rows ordered by brand code then color
 * sort_order; Map.groupBy folds them per brand so the colors array index
 * matches the 1-based grid index the editor stores.
 */
export async function GET() {
  const rows = await db
    .select()
    .from(brands)
    .leftJoin(colors, eq(colors.fkBrandId, brands.id))
    .orderBy(brands.code, colors.sortOrder)

  const result = Array.from(
    Map.groupBy(rows, (row) => row.brands.id),
    ([, group]) => ({
      ...group[0].brands,
      colors: group.flatMap((row) => (row.colors ? [row.colors] : [])),
    }),
  )
  return NextResponse.json({ brands: result })
}
