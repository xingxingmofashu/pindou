import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { brands, colors } from "@/db/schema"
import { Palette } from "@/types"

/**
 * GET /api/brands/[id] — one brand with its colors nested.
 * The route segment is the brand row's uuid id (e.g. a pattern's `brandId`),
 * which the client receives from `/api/brands` or `/api/patterns/[id]`. Same
 * left-join + fold as the catalog route, restricted to one brand. Unknown or
 * malformed ids return 404.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Guard against malformed ids: Postgres rejects non-uuid values in a uuid
  // column comparison with a type error, which would surface as a 500.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 })
  }

  const rows = await db
    .select()
    .from(brands)
    .leftJoin(colors, eq(colors.fkBrandId, brands.id))
    .where(eq(brands.id, id))
    .orderBy(colors.sortOrder)

  if (rows.length === 0) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 })
  }

  return NextResponse.json<Palette>({
    ...rows[0].brands,
    colors: rows.flatMap((row) => (row.colors ? [row.colors] : [])),
  })
}
