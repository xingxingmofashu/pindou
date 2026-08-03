import { z } from "zod"
import { MAX_GRID_DIMENSION } from "@/lib/editor"

/* ---- Grid ---- */

/** A single cell of the pattern grid; 0 = empty, >0 = 1-based palette index. */
const gridCellSchema = z.number().int().min(0)

const gridRowSchema = z.array(gridCellSchema)

/** Strict shape used to validate incoming grids: bounded + rectangular. */
const gridSchema = z
  .array(gridRowSchema)
  .min(1, `Grid rows must be 1–${MAX_GRID_DIMENSION}`)
  .max(MAX_GRID_DIMENSION, `Grid rows must be 1–${MAX_GRID_DIMENSION}`)
  .refine(
    (rows) => rows[0].length > 0 && rows[0].length <= MAX_GRID_DIMENSION,
    { message: `Grid columns must be 1–${MAX_GRID_DIMENSION}` },
  )
  .refine((rows) => rows.every((row) => row.length === rows[0].length), {
    message: "Grid must be rectangular",
  })

/* ---- Request validation ---- */

/**
 * Validates the POST /api/patterns request body. Shared between the API route
 * (authoritative) and the publish dialog (client-side pre-check).
 */
export const createPatternSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(100, "Title must be ≤100 characters"),
  description: z
    .string()
    .max(280, "Description must be ≤280 characters")
    .optional(),
  author_name: z
    .string()
    .max(50, "Author name must be ≤50 characters")
    .optional(),
  grid: gridSchema,
  brand_id: z.string().optional(),
})

/** Validates the `page` query parameter in GET requests; defaults to 1. */
export const pageSchema = z.coerce.number().int().min(1).catch(1)

/* ---- Response validation ---- */

const beadColorSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  hex: z.string(),
  series: z.string().optional(),
})

const beadPaletteSchema = z.object({
  id: z.string(),
  brand: z.string(),
  colors: z.array(beadColorSchema),
})

/** Fields shared by every pattern payload (list item and detail). */
const patternCoreSchema = z.object({
  id: z.string(),
  title: z.string(),
  brandId: z.string(),
  authorName: z.string().nullable(),
  beadStats: z.record(z.string(), z.number()),
  createdAt: z.string(),
})

/** Shape of one pattern in the gallery list response. */
export const patternSummarySchema = patternCoreSchema.extend({
  thumbPng: z.string(),
})

export const patternListResponseSchema = z.object({
  patterns: z.array(patternSummarySchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})

export const patternDetailResponseSchema = patternCoreSchema.extend({
  description: z.string(),
  grid: z.array(gridRowSchema),
  palette: beadPaletteSchema,
})

/** Every API error response shares this `{ error }` envelope. */
export const errorResponseSchema = z.object({ error: z.string() })

export type CreatePatternInput = z.infer<typeof createPatternSchema>
export type PatternSummary = z.infer<typeof patternSummarySchema>
export type PatternListResponse = z.infer<typeof patternListResponseSchema>
export type PatternDetailResponse = z.infer<typeof patternDetailResponseSchema>
export type ErrorResponse = z.infer<typeof errorResponseSchema>
