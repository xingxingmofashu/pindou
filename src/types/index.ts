import { brands, colors } from '@/db/schema'
/** A row of `brands` as selected from the DB (uuid id, timestamps as Date). */
export type Brand = typeof brands.$inferSelect
/** A row of `colors` as selected from the DB. */
export type Color = typeof colors.$inferSelect

/**
 * A `brands` row with its colors nested — the resolved palette clients render
 * with. Colors are ordered by `sortOrder` (the seed-time array index grid cells
 * index into).
 */
export type Palette = Brand & { colors: Color[] }