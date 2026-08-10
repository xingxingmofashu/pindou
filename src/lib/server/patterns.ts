import "server-only"
import { unstable_cache } from "next/cache"
import { desc, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { brands, colors, patterns } from "@/db/schema"
import { GridStorage } from "@/lib/grid-storage"
import type { Palette } from "@/types"

/** Grid JSON storage (R2) shared by the data-access functions below. */
const grids = new GridStorage()

/**
 * The paginated pattern list, cached in the data cache (30s) per
 * `page`/`pageSize`. Publishing or editing invalidates it on-demand via
 * {@link revalidateTag}. Used by both GET /api/patterns and the SSR catalog
 * page so a single cached copy serves both.
 */
export const getPatternsPage = unstable_cache(
  async (page: number, pageSize: number) => {
    const rows = await db
      .select({
        id: patterns.id,
        title: patterns.title,
        authorName: patterns.authorName,
        brandCode: brands.code,
        beadStats: patterns.beadStats,
        thumbUrl: patterns.thumbUrl,
        createdAt: patterns.createdAt,
        total: sql<number>`count(*) over()`.as("total"),
      })
      .from(patterns)
      .innerJoin(brands, eq(patterns.fkBrandId, brands.id))
      .orderBy(desc(patterns.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total = Number(rows[0]?.total ?? 0)
    return { rows, total }
  },
  ["patterns"],
  { revalidate: 30, tags: ["patterns"] },
)

/**
 * Public pattern data (row + R2 grid JSON) cached via the data cache — the
 * grid fetch from R2 is the expensive part, so it's cached across requests.
 * Edits invalidate every pattern entry via {@link revalidateTag} on PATCH,
 * with a 30s time-based fallback.
 */
export const getPattern = unstable_cache(
  async (id: string) => {
    const [row] = await db
      .select({
        id: patterns.id,
        title: patterns.title,
        description: patterns.description,
        authorName: patterns.authorName,
        brandCode: brands.code,
        brandId: patterns.fkBrandId,
        gridKey: patterns.gridKey,
        beadStats: patterns.beadStats,
        thumbUrl: patterns.thumbUrl,
        fkUserId: patterns.fkUserId,
        createdAt: patterns.createdAt,
        updatedAt: patterns.updatedAt,
      })
      .from(patterns)
      .innerJoin(brands, eq(patterns.fkBrandId, brands.id))
      .where(eq(patterns.id, id))
    if (!row) return null
    const grid = await grids.get(row.gridKey)
    return { ...row, grid }
  },
  ["pattern"],
  { revalidate: 30, tags: ["pattern"] },
)

/**
 * A brand's resolved palette (brand row + nested colors), cached for a week —
 * palettes only change via `db:migrate`. The wire shape matches
 * GET /api/brands/[id].
 */
export const getBrandPalette = unstable_cache(
  async (id: string): Promise<Palette | null> => {
    const rows = await db
      .select()
      .from(brands)
      .leftJoin(colors, eq(colors.fkBrandId, brands.id))
      .where(eq(brands.id, id))
      .orderBy(colors.sortOrder)
    if (rows.length === 0) return null
    return {
      ...rows[0].brands,
      colors: rows.flatMap((row) => (row.colors ? [row.colors] : [])),
    }
  },
  ["brand-palette"],
  { revalidate: 604800, tags: ["brand-palette"] },
)
