import "server-only"
import { unstable_cache } from "next/cache"
import { desc, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { brands, patterns } from "@/db/schema"
import { GridStorage } from "@/lib/grid-storage"

/** Grid JSON storage (R2) shared by the data-access functions below. */
const grids = new GridStorage()

/**
 * `unstable_cache` round-trips results through JSON, so Date objects come back
 * as ISO strings on cache hits. Normalize at the data layer so callers always
 * receive a stable shape regardless of cache state.
 */
function isoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}

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
    return {
      rows: rows.map((r) => ({ ...r, createdAt: isoDate(r.createdAt) })),
      total,
    }
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
    return {
      ...row,
      createdAt: isoDate(row.createdAt),
      updatedAt: isoDate(row.updatedAt),
      grid,
    }
  },
  ["pattern"],
  { revalidate: 30, tags: ["pattern"] },
)
