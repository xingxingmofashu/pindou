import { NextResponse } from "next/server"
import { db } from "@/db"
import { brands } from "@/db/schema"
import { getBrandPalette } from "@/lib/server/palettes"
import type { Palette } from "@pindou/core/types"

/**
 * GET /api/brands/[id] — one brand with its colors nested.
 * The route segment is the brand row's uuid id (e.g. a pattern's `brandId`),
 * which the client receives from `/api/brands` or `/api/patterns/[id]`. The
 * palette query lives in `@/lib/server/patterns` (shared with the SSR pattern
 * page) and is cached for a week.
 *
 * The catalog only changes via `db:migrate`, so brand pages are statically
 * generated at build time (`generateStaticParams`) and re-validated every
 * {@link revalidate} seconds (ISR); `dynamicParams = false` makes any unknown
 * id a hard 404 instead of an on-demand render. A `db:migrate` change lands on
 * the next deploy.
 */
export const revalidate = 604800
export const dynamicParams = false

export async function generateStaticParams() {
  const rows = await db.select({ id: brands.id }).from(brands)
  return rows.map(({ id }) => ({ id }))
}

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

  const palette = await getBrandPalette(id)

  if (!palette) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 })
  }

  return NextResponse.json<Palette>(
    palette,
    {
      headers: {
        // Mirrors the catalog route: the palette only changes via db:migrate,
        // but it *does* change (e.g. a reorder), so an immutable year-long
        // cache would pin old data in browsers after a migrate. Let CDNs and
        // browsers revalidate hourly and fall back to stale while they do.
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  )
}
