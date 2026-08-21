import palettes from "./palettes.json"
import type { Palette } from "./types"

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
