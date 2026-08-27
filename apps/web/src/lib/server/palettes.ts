import { PALETTES } from "@pindou/shared/palettes"
import type { Palette } from "@pindou/shared/types"

/**
 * Resolve a brand's palette by its wire `code` (e.g. `"mard"`), optionally
 * excluding colour codes. Returns `null` when the brand doesn't exist; an
 * empty `colors` array means every colour was excluded.
 *
 * Data source is the bundled static catalog (`@pindou/shared/palettes`, a
 * snapshot from the production DB) — the same file the desktop app ships, so
 * web and desktop always agree. Palette changes land by editing
 * `packages/shared/src/palettes.json` and rebuilding.
 */
export function getPaletteByCode(
  code: string,
  excludedCodes: string[] = [],
): Palette | null {
  const brand = PALETTES.find((b) => b.code === code)
  if (!brand) return null
  if (excludedCodes.length === 0) return brand
  const exclude = new Set(excludedCodes)
  return { ...brand, colors: brand.colors.filter((c) => !exclude.has(c.code)) }
}

/**
 * Resolve a brand's palette by its uuid `id`. Returns `null` when the brand
 * doesn't exist. The uuid ids in `palettes.json` are stable (from the original
 * DB seed), so `patterns.fk_brand_id` values stay valid across the migration.
 */
export function getPaletteById(id: string): Palette | null {
  return PALETTES.find((b) => b.id === id) ?? null
}

/**
 * Brand uuids whose `code` contains `query` (case-insensitive, SQL `ilike`
 * semantics). Used to translate a brand-code search term into the `fk_brand_id`
 * uuids a pattern-list query filters on.
 */
export function getPalettesMatching(query: string): string[] {
  const needle = query.toLowerCase()
  return PALETTES.filter((b) => b.code.toLowerCase().includes(needle)).map((b) => b.id)
}

/**
 * A brand's resolved palette (brand row + nested colors). Pure static lookup —
 * no DB, no caching layer needed. Signature kept async for drop-in
 * compatibility with the previous DB-backed implementation.
 */
export async function getBrandPalette(id: string): Promise<Palette | null> {
  return getPaletteById(id)
}

/**
 * Every brand with its colors nested (the client catalog), straight from the
 * bundled JSON. Colors are already ordered by `sortOrder` in the file, so the
 * array index matches the 1-based grid index the editor stores. Signature kept
 * async for drop-in compatibility.
 */
export async function getAllPalettes(): Promise<Palette[]> {
  return PALETTES
}
