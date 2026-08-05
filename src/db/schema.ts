import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { z } from "zod"
import { createSchemaFactory } from "drizzle-zod"
import { MAX_GRID_DIMENSION } from "../lib/editor"

export const patterns = pgTable("patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  authorName: text("author_name"),
  /** Dense 2D grid serialized as JSON: number[][] — 0 = empty, ≥1 = palette index */
  gridData: text("grid_data").notNull(),
  /** Brand UUID referencing brands.id; code→uuid mapping lives in the app layer. */
  fkBrandId: uuid("fk_brand_id").notNull().references(() => brands.id),
  beadStats: text("bead_stats").notNull().default("{}"),
  /** PNG thumbnail (base64) generated server-side on publish. */
  thumbPng: text("thumb_png").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Bead brands. `id` is a generated UUID; `code` is the stable brand code the
 * rest of the app uses (e.g. "mard" — the `Brand` union value); `name` is the
 * display name. patterns.fk_brand_id references `id`.
 */
export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Bead colours per brand. Grid cells are 1‑based indices into a brand's colour
 * array, so `sortOrder` (the array index at seed time) MUST match the order the
 * palette is served in — never reorder existing rows.
 */
export const colors = pgTable(
  "colors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fkBrandId: uuid("fk_brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    hex: text("hex").notNull(),
    series: text("series"),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("colors_brand_code_unique").on(t.fkBrandId, t.code)],
)

/**
 * Zod mirrors of the tables plus the composite wire shapes, generated from the
 * tables above via drizzle-zod instead of hand-written. Dates are coerced so
 * the ISO strings JSON responses serve parse cleanly.
 */
const { createSelectSchema, createInsertSchema } = createSchemaFactory({
  coerce: { date: true },
})

/** A `brands` row as served over JSON. */
export const BrandSelectSchema = createSelectSchema(brands)

/** A `colors` row as served over JSON. */
export const ColorSelectSchema = createSelectSchema(colors)


/**
 * Wire shape of a published pattern (GET /api/patterns/[id]): the `patterns`
 * row joined with the brand code, `gridData` parsed to a number[][], and the
 * brand FK surfaced as `brandId` alongside the wire `brandCode`.
 */
export const PatternSelectSchema = createSelectSchema(patterns, {
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
    }),
  createdAt: z.string(),
  updatedAt: z.string(),
})
  .extend({ brandCode: z.string(), brandId: z.uuid() })
  .omit({ fkBrandId: true })

/**
 * Client-supplied fields for POST /api/patterns. `beadStats` is computed
 * client-side at publish time; server-generated fields (thumbPng, timestamps)
 * are added on the route.
 */
export const PatternInsertSchema = createInsertSchema(patterns, {
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
    }),
  beadStats: z.string(),
})
  .omit({ id: true, fkBrandId: true, thumbPng: true, createdAt: true, updatedAt: true })
  .extend({ brandCode: z.string() })

/** Query-parameter pagination for GET /api/patterns. */
export const PaginationSchema = z.object({
  total: z.number().int().min(0).catch(0),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).catch(20),
})

/** Response shape for the paginated GET /api/patterns. */
export const PatternsResponseSchema = z.object({
  patterns: z.array(PatternSelectSchema),
  pagination: PaginationSchema,
})



/** Every API error response shares this `{ error }` envelope. */
export const ErrorSchema = z.object({ error: z.string() })

export type PaletteSelectType = z.infer<typeof PatternSelectSchema>
export type PatternResponseType = z.infer<typeof PatternsResponseSchema>
