import "server-only"
import { unstable_cache } from "next/cache"
import { desc, eq, ilike, inArray, or, sql } from "drizzle-orm"
import { db } from "@/db"
import { patterns } from "@/db/schema"
import { GridStorage } from "@pindou/core/server/grid-storage"
import { escapeLike } from "@/lib/utils"
import { getPaletteById, getPalettesMatching } from "@/lib/server/palettes"

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

/** Resolve a pattern's brand code from its uuid via the bundled palette catalog. */
function brandCodeOf(fkBrandId: string): string {
  return getPaletteById(fkBrandId)?.code ?? ""
}

/**
 * The paginated pattern list, cached in the data cache (30s) per
 * `page`/`pageSize`/`query`. Publishing or editing invalidates it on-demand via
 * {@link revalidateTag}. Used by both GET /api/patterns and the SSR catalog
 * page so a single cached copy serves both.
 *
 * The brand code is not stored on the row — it's resolved from the bundled
 * palette catalog (`packages/shared/src/palettes.json`) via the pattern's
 * `fk_brand_id` uuid, so no join is needed.
 *
 * @param query - Optional search term matched case-insensitively against the
 *                pattern title, author name, and brand code. `undefined` or a
 *                blank string returns all patterns.
 */
export const getPatternsPage = unstable_cache(
  async (page: number, pageSize: number, query?: string) => {
    const q = query?.trim()
    const like = q ? `%${escapeLike(q)}%` : undefined
    // Brand-code search resolves matching brand uuids from the palette catalog
    // and filters on the column directly (a JS filter would break pagination).
    const brandIds = q ? getPalettesMatching(q) : []
    const where = like
      ? or(
          ilike(patterns.title, like),
          ilike(patterns.authorName, like),
          inArray(patterns.fkBrandId, brandIds),
        )
      : undefined
    const rows = await db
      .select({
        id: patterns.id,
        title: patterns.title,
        authorName: patterns.authorName,
        fkBrandId: patterns.fkBrandId,
        beadStats: patterns.beadStats,
        thumbUrl: patterns.thumbUrl,
        createdAt: patterns.createdAt,
        total: sql<number>`count(*) over()`.as("total"),
      })
      .from(patterns)
      .where(where)
      .orderBy(desc(patterns.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total = Number(rows[0]?.total ?? 0)
    return {
      rows: rows.map((r) => ({
        id: r.id,
        title: r.title,
        authorName: r.authorName,
        brandCode: brandCodeOf(r.fkBrandId),
        beadStats: r.beadStats,
        thumbUrl: r.thumbUrl,
        createdAt: isoDate(r.createdAt),
      })),
      total,
    }
  },
  ["patterns"],
  { revalidate: 30, tags: ["patterns"] },
)

/**
 * Every published pattern id, cached in the data cache (5m). The sitemap needs
 * only the ids (not the full rows or their R2 grids), so this is a cheap
 * id-only query — publishing/editing invalidates it via {@link revalidateTag}.
 */
export const getAllPatternIds = unstable_cache(
  async (): Promise<string[]> => {
    const rows = await db.select({ id: patterns.id }).from(patterns)
    return rows.map((r) => r.id)
  },
  ["pattern-ids"],
  { revalidate: 300, tags: ["patterns"] },
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
        fkBrandId: patterns.fkBrandId,
        gridKey: patterns.gridKey,
        beadStats: patterns.beadStats,
        thumbUrl: patterns.thumbUrl,
        fkUserId: patterns.fkUserId,
        createdAt: patterns.createdAt,
        updatedAt: patterns.updatedAt,
      })
      .from(patterns)
      .where(eq(patterns.id, id))
    if (!row) return null
    const grid = await grids.get(row.gridKey)
    return {
      ...row,
      brandCode: brandCodeOf(row.fkBrandId),
      brandId: row.fkBrandId,
      createdAt: isoDate(row.createdAt),
      updatedAt: isoDate(row.updatedAt),
      grid,
    }
  },
  ["pattern"],
  { revalidate: 30, tags: ["pattern"] },
)
