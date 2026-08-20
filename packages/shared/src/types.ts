/**
 * Shared wire types for the bead pattern domain.
 *
 * These mirror the drizzle table shapes used by the web app's Postgres schema
 * (`Brand`/`Color`/`Palette`) but are hand-written so the package stays
 * database-agnostic — the desktop app (SQLite) consumes the same shapes.
 */

/**
 * A bead brand row as served over JSON (`GET /api/brands`): `id` is a uuid,
 * `code` is the stable brand code the rest of the app uses (e.g. `"mard"`),
 * `name` is the display name. `patterns.fk_brand_id` references `id`.
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
 * A bead colour row as served over JSON. Grid cells are 1-based indices into
 * a brand's colour array, so `sortOrder` (the array index at seed time) MUST
 * match the order the palette is served in — never reorder existing rows.
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
 * A `brands` row with its colors nested — the resolved palette clients render
 * with. Colors are ordered by `sortOrder` (the seed-time array index grid
 * cells index into).
 */
export type Palette = Brand & { colors: Color[] }
