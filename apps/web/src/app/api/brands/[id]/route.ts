import { NextResponse } from "next/server"
import { getBrandPalette } from "@/lib/server/palettes"
import type { Palette } from "@pindou/shared/types"

/**
 * GET /api/brands/[id] — one brand with its colors nested.
 * The route segment is the brand uuid (e.g. a pattern's `brandId`), which the
 * client receives from `/api/brands` or `/api/patterns/[id]`.
 *
 * The palette is served from the bundled static catalog
 * (`packages/shared/src/palettes.json`) — no DB. Unknown ids are a runtime
 * 404 (`dynamicParams = true`), so any id in the catalog works on demand.
 *
 * The catalog only changes with a rebuild (it's a committed JSON file), so the
 * response is cached for a week and re-validated (ISR). A palette edit lands
 * on the next deploy.
 */
export const revalidate = 604800

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Guard against malformed ids: previously Postgres rejected non-uuid values
  // with a type error; now it's just an early exit for an id that can't exist.
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
        // Mirrors the catalog route: the palette only changes on a rebuild,
        // but it *does* change, so an immutable year-long cache would pin old
        // data in browsers after a deploy. Let CDNs and browsers revalidate
        // hourly and fall back to stale while they do.
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  )
}
