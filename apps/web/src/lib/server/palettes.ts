import { PALETTES } from "@pindou/shared/palettes"
import type { Palette } from "@pindou/shared/palettes"

/**
 * Lookups over the bundled static palette catalog.
 *
 * Data source is `@pindou/shared/palettes` (a snapshot of the production DB,
 * committed as JSON) — the same file the desktop app ships, so web and desktop
 * always agree. Palette changes land by editing `palettes.json` and rebuilding;
 * there is no DB table and no cache layer.
 */
export class PaletteService {
  /**
   * Resolve a brand's palette by its wire `code` (e.g. `"mard"`), optionally
   * excluding colour codes.
   *
   * @param code          - The brand code.
   * @param excludedCodes - Colour codes to strip from the result.
   * @returns The palette, or `null` when the brand doesn't exist. An empty
   *          `colors` array means every colour was excluded.
   */
  static byCode(code: string, excludedCodes: string[] = []): Palette | null {
    const brand = PALETTES.find((b) => b.code === code)
    if (!brand) return null
    if (excludedCodes.length === 0) return brand
    const exclude = new Set(excludedCodes)
    return { ...brand, colors: brand.colors.filter((c) => !exclude.has(c.code)) }
  }

  /**
   * Resolve a brand's palette by its uuid `id`.
   *
   * The uuid ids in `palettes.json` are stable (from the original DB seed), so
   * `patterns.fk_brand_id` values stay valid across the migration.
   *
   * @param id - The brand uuid.
   * @returns The palette, or `null` when it doesn't exist.
   */
  static byId(id: string): Palette | null {
    return PALETTES.find((b) => b.id === id) ?? null
  }

  /**
   * Brand uuids whose `code` contains `query` (case-insensitive, SQL `ilike`
   * semantics). Used to translate a brand-code search term into the
   * `fk_brand_id` uuids a pattern-list query filters on.
   *
   * @param query - The search term.
   * @returns The matching brand uuids.
   */
  static matching(query: string): string[] {
    const needle = query.toLowerCase()
    return PALETTES.filter((b) => b.code.toLowerCase().includes(needle)).map((b) => b.id)
  }

  /**
   * A brand's resolved palette (brand row + nested colors).
   *
   * Signature kept async for drop-in compatibility with the previous
   * DB-backed implementation.
   *
   * @param id - The brand uuid.
   * @returns The palette, or `null` when it doesn't exist.
   */
  static async brand(id: string): Promise<Palette | null> {
    return PaletteService.byId(id)
  }

  /**
   * Every brand with its colors nested (the client catalog), straight from the
   * bundled JSON. Colors are already ordered by `sortOrder`, so the array index
   * matches the 1-based grid index the editor stores.
   *
   * Signature kept async for drop-in compatibility with the previous
   * DB-backed implementation.
   *
   * @returns Every palette.
   */
  static async all(): Promise<Palette[]> {
    return PALETTES
  }
}
