import palettes from "./palettes.json"

/**
 * A brand entry from the bundled palette catalog (`palettes.json`).
 *
 * The catalog is a static snapshot (uuid id, code, name, sort order, and
 * nested colors) served to the web app via `/api/brands` and bundled into the
 * desktop app — it is the single source of truth for palettes, replacing the
 * former `brands` DB table. `id` is a stable uuid that `patterns.fk_brand_id`
 * references.
 */
export interface Brand {
  id: string
  code: string
  name: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

/**
 * A colour entry nested under a {@link Brand} in `palettes.json`.
 *
 * Replaces the former `colors` DB table. `code` is the colour code (e.g.
 * "A1") used in pattern grids; `fkBrandId` matches the parent brand's id.
 */
export interface Color {
  id: string
  fkBrandId: string
  code: string
  name: string
  hex: string
  series: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

/**
 * A `brands` entry with its colors nested — the resolved palette clients render
 * with. Colors are ordered by `sortOrder` (the array index grid cells index
 * into).
 */
export type Palette = Brand & { colors: Color[] }

/**
 * The full brand/color catalog, bundled into the shared package.
 *
 * A static snapshot taken from the production Neon database (same query the
 * web app's GET /api/brands serves) — the desktop app gets the same 560-color
 * catalog the web app serves, without any network request. Regenerate it with
 * a one-off query against production when the catalog changes.
 *
 * The JSON stores timestamps as ISO strings; the {@link Palette} type expects
 * `Date` (its rows come from the DB), so dates are converted on load.
 */
export const PALETTES: Palette[] = palettes.map((brand) => ({
  ...brand,
  createdAt: new Date(brand.createdAt),
  updatedAt: new Date(brand.updatedAt),
  colors: brand.colors.map((color) => ({
    ...color,
    createdAt: new Date(color.createdAt),
    updatedAt: new Date(color.updatedAt),
  })),
}))
