import { NextResponse } from "next/server"
import { getAllPalettes } from "@/lib/server/palettes"
import type { Palette } from "@pindou/shared/types"

/**
 * GET /api/brands — every brand with its colors nested (the client catalog).
 * Served from the bundled static catalog (`packages/shared/src/palettes.json`,
 * via `@/lib/server/palettes`) — the same file the desktop app ships.
 *
 * The catalog only changes with a rebuild (it's a committed JSON file), so the
 * handler is statically generated at build time and re-validated every
 * {@link revalidate} seconds (ISR), and the response is served from the
 * edge/CDN without touching Neon per request. A palette edit lands on the next
 * deploy.
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
