import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { brands, colors } from "@/db/schema"
import { Palette } from "@/types"

/**
 * GET /api/brands — every brand with its colors nested (the client catalog).
 * A single left join yields flat rows ordered by brand sort_order then color
 * sort_order; Map.groupBy folds them per brand so the colors array index
 * matches the 1-based grid index the editor stores.
 *
 * The catalog only changes via `db:migrate` (data migration 0006), so it's
 * effectively immutable at runtime — safe to cache at the CDN and in the
 * browser, cutting per-visit Neon queries.
 */
export async function GET() {
  const rows = await db
    .select()
    .from(brands)
    .leftJoin(colors, eq(colors.fkBrandId, brands.id))
    .orderBy(brands.sortOrder, colors.sortOrder)

  const result = Array.from(
    Map.groupBy(rows, (row) => row.brands.id),
    ([, group]) => ({
      ...group[0].brands,
      colors: group.flatMap((row) => (row.colors ? [row.colors] : [])),
    }),
  )
  return NextResponse.json<Array<Palette>>(result, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
