import { brands, colors, patterns } from '@/db/schema'
/** A row of `brands` as selected from the DB (uuid id, timestamps as Date). */
export type Brand = typeof brands.$inferSelect
/** A row of `colors` as selected from the DB. */
export type Color = typeof colors.$inferSelect
/** A row of `patterns` as selected from the DB. */
export type Pattern = typeof patterns.$inferSelect

/**
 * A `brands` row with its colors nested — the resolved palette clients render
 * with. Colors are ordered by `sortOrder` (the seed-time array index grid cells
 * index into).
 */
export type Palette = Brand & { colors: Color[] }

/** A color as declared in the static brand source files (seed input, not a DB row). */
export interface SeedColor {
  id: string
  code: string
  name: string
  hex: string
  series?: string
}

/** A palette as declared in the static brand source files — seed data only. */
export interface SeedPalette {
  code: string
  brand: string
  colors: SeedColor[]
}