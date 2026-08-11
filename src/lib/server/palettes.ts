import "server-only"
import { unstable_cache } from "next/cache"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { brands, colors } from "@/db/schema"
import type { Palette } from "@/types"

/**
 * Resolve a brand's palette by its wire `code` (e.g. `"mard"`), optionally
 * excluding colour codes. Uncached — used by mutation/transform paths that
 * need the current palette. Returns `null` when the brand doesn't exist; an
 * empty `colors` array means every colour was excluded.
 */
export async function getPaletteByCode(
  code: string,
  excludedCodes: string[] = [],
): Promise<Palette | null> {
  const [brand] = await db
    .select()
    .from(brands)
    .where(eq(brands.code, code))
    .limit(1)
  if (!brand) return null
  return getPaletteForBrand(brand, excludedCodes)
}

/**
 * Resolve a brand's palette by its uuid `id`. Uncached — used by the edit path
 * where freshness matters.
 */
export async function getPaletteById(id: string): Promise<Palette | null> {
  const [brand] = await db
    .select()
    .from(brands)
    .where(eq(brands.id, id))
    .limit(1)
  if (!brand) return null
  return getPaletteForBrand(brand)
}

/** Fold a brand row + its ordered colors into a resolved {@link Palette}. */
async function getPaletteForBrand(
  brand: typeof brands.$inferSelect,
  excludedCodes: string[] = [],
): Promise<Palette> {
  const exclude = new Set(excludedCodes)
  const colorRows = (
    await db
      .select()
      .from(colors)
      .where(eq(colors.fkBrandId, brand.id))
      .orderBy(colors.sortOrder)
  ).filter((c) => !exclude.has(c.code))
  return { ...brand, colors: colorRows }
}

/**
 * A brand's resolved palette (brand row + nested colors), cached for a week —
 * palettes only change via `db:migrate`. The wire shape matches
 * GET /api/brands/[id].
 */
export const getBrandPalette = unstable_cache(
  (id: string) => getPaletteById(id),
  ["brand-palette"],
  { revalidate: 604800, tags: ["brand-palette"] },
)

/**
 * Every brand with its colors nested (the client catalog). A single left join
 * yields flat rows ordered by brand sort_order then color sort_order;
 * `Map.groupBy` folds them per brand so the colors array index matches the
 * 1-based grid index the editor stores. Cached for a week — palettes only
 * change via `db:migrate`. Mirrors GET /api/brands.
 */
export const getAllPalettes = unstable_cache(
  async (): Promise<Palette[]> => {
    const rows = await db
      .select()
      .from(brands)
      .leftJoin(colors, eq(colors.fkBrandId, brands.id))
      .orderBy(brands.sortOrder, colors.sortOrder)
    return Array.from(
      Map.groupBy(rows, (row) => row.brands.id),
      ([, group]) => ({
        ...group[0].brands,
        colors: group.flatMap((row) => (row.colors ? [row.colors] : [])),
      }),
    )
  },
  ["brand-catalog"],
  { revalidate: 604800, tags: ["brand-catalog"] },
)
