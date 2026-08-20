import { z } from "zod"
import { MAX_GRID_CELLS, MAX_GRID_DIMENSION, PATTERNS_PAGE_SIZE } from "./constants"

/**
 * Shared `gridData` wire schema (used by both the select and insert schemas):
 * a rectangular `string[][]` whose rows/columns stay within
 * {@link MAX_GRID_DIMENSION}; `""` = empty cell, any other value is a brand
 * colour code (e.g. "A1"). The total cell count is additionally bounded by
 * {@link MAX_GRID_CELLS} so a single pattern can't blow up the wire/DB payload.
 */
export const gridDataSchema = z
  .array(z.array(z.string().max(16)))
  .min(1, `Grid rows must be 1–${MAX_GRID_DIMENSION}`)
  .max(MAX_GRID_DIMENSION, `Grid rows must be 1–${MAX_GRID_DIMENSION}`)
  .refine(
    (rows) => rows[0].length > 0 && rows[0].length <= MAX_GRID_DIMENSION,
    { message: `Grid columns must be 1–${MAX_GRID_DIMENSION}` },
  )
  .refine((rows) => rows.every((row) => row.length === rows[0].length), {
    message: "Grid must be rectangular",
  })
  .refine((rows) => rows.length * rows[0].length <= MAX_GRID_CELLS, {
    message: `Grid must be at most ${MAX_GRID_CELLS} cells (rows × columns)`,
  })

/**
 * Wire shape of a published pattern (GET /api/patterns/[id]): the `patterns`
 * row (uuid id, ISO timestamps) joined with the brand code, `gridData`
 * fetched from storage and parsed to a code `string[][]`, and the brand FK
 * surfaced as `brandId` alongside the wire `brandCode`. `gridKey` and owner
 * FKs are server-internal and never sent to the client.
 */
export const PatternSelectSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  authorName: z.string().nullable(),
  beadStats: z.string(),
  thumbUrl: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  gridData: gridDataSchema,
  brandCode: z.string(),
  brandId: z.uuid(),
})

/**
 * Client-supplied fields for POST /api/patterns. `beadStats` is computed
 * client-side at publish time; server-generated fields (thumbUrl, timestamps)
 * are added on the route. Text lengths are capped so a single request can't
 * carry an unbounded payload.
 */
export const PatternInsertSchema = z.object({
  title: z.string().max(200, "Title must be at most 200 characters"),
  description: z.string().max(2000, "Description must be at most 2000 characters"),
  beadStats: z.string().max(100_000, "Bead stats must be at most 100,000 characters"),
  gridData: gridDataSchema,
  brandCode: z.string(),
})

/** Query-parameter pagination for GET /api/patterns. */
export const PaginationSchema = z.object({
  total: z.number().int().min(0).catch(0),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(PATTERNS_PAGE_SIZE).catch(PATTERNS_PAGE_SIZE),
})

/** Response shape for the paginated GET /api/patterns. */
export const PatternsResponseSchema = z.object({
  patterns: z.array(PatternSelectSchema),
  pagination: PaginationSchema,
})

/**
 * Wire shape of GET /api/patterns/[id]: {@link PatternSelectSchema} plus a
 * server-computed `canEdit` flag (whether the requester owns the pattern).
 */
export const PatternDetailSchema = PatternSelectSchema.extend({
  canEdit: z.boolean(),
})

/**
 * Client-supplied fields for PATCH /api/patterns/[id]. Same shape as the
 * publish body minus the brand code — the pattern's brand is preserved.
 */
export const PatternUpdateSchema = PatternInsertSchema.omit({ brandCode: true })

/** Every API error response shares this `{ error }` envelope. */
export const ErrorSchema = z.object({ error: z.string() })

export type PaletteSelectType = z.infer<typeof PatternSelectSchema>
export type PatternDetailType = z.infer<typeof PatternDetailSchema>
export type PatternResponseType = z.infer<typeof PatternsResponseSchema>
