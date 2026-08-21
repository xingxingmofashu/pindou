/** A row of `brands` as selected from the DB (uuid id, timestamps as Date). */
export interface Brand {
  id: string
  code: string
  name: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

/** A row of `colors` as selected from the DB. */
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
 * with. Colors are ordered by `sortOrder` (the seed-time array index grid cells
 * index into).
 */
export type Palette = Brand & { colors: Color[] }
