import { NextResponse } from "next/server"
import { getAllPalettes } from "@/lib/server/palettes"
import type { Palette } from "@pindou/shared/types"

/**
 * GET /api/brands — every brand with its colors nested (the client catalog).
 * The query lives in `@/lib/server/patterns` (shared with the SSR pattern
 * pages) and is cached for a week.
 *
 * The catalog only changes via `db:migrate` (data migration 0006), so it's
 * effectively immutable at runtime. The handler is statically generated at
 * build time and re-validated every {@link revalidate} seconds (ISR), so the
 * response is served from the edge/CDN without touching Neon per request; a
 * `db:migrate` change lands on the next deploy (or `revalidatePath`).
 */
export const revalidate = 604800

export async function GET() {
  const result = await getAllPalettes()
  return NextResponse.json<Array<Palette>>(result, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
