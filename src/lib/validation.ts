import { z } from "zod"
import { MAX_GRID_DIMENSION } from "@/lib/editor"

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize:  z.coerce.number().int().min(1).max(100).default(20).catch(20),
})

export const PaletteSchema = z.object({
  id: z.string(),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(100, "Title must be ≤100 characters"),
  description: z
    .string()
    .max(280, "Description must be ≤280 characters")
    .optional(),
  authorName: z
    .string()
    .max(50, "Author name must be ≤50 characters")
    .optional(),
  gridData: z
    .array(z.array(z.number().int().min(0)))
    .min(1, `Grid rows must be 1–${MAX_GRID_DIMENSION}`)
    .max(MAX_GRID_DIMENSION, `Grid rows must be 1–${MAX_GRID_DIMENSION}`)
    .refine(
      (rows) => rows[0].length > 0 && rows[0].length <= MAX_GRID_DIMENSION,
      { message: `Grid columns must be 1–${MAX_GRID_DIMENSION}` },
    )
    .refine((rows) => rows.every((row) => row.length === rows[0].length), {
      message: "Grid must be rectangular",
    })
  ,
  brandId: z.string().optional(),
  brandStats: z.string(),
  thumbPng: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})


/**
 * Client-supplied fields for POST /api/patterns. Server-generated fields
 * (brandStats, thumbPng, createdAt, updatedAt) are added on the route.
 */
export const CreatePatternSchema = PaletteSchema.omit({
  id: true,
  brandStats: true,
  thumbPng: true,
  createdAt: true,
  updatedAt: true,
})

/** A gallery card item — the pattern record minus heavy detail fields. */
export const PatternSummarySchema = PaletteSchema.omit({
  description: true,
  gridData: true,
  updatedAt: true,
})

/** Response shape for the paginated GET /api/patterns. */
export const PatternListResponseSchema = z.object({
  patterns: z.array(PatternSummarySchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})

/** Every API error response shares this `{ error }` envelope. */
export const ErrorSchema = z.object({ error: z.string() })

export type PaletteType = z.infer<typeof PaletteSchema>
export type PatternSummary = z.infer<typeof PatternSummarySchema>
export type PatternListResponse = z.infer<typeof PatternListResponseSchema>
