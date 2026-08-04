import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Bead colours per brand. Grid cells are 1‑based indices into a brand's colour
 * array, so `sortOrder` (the array index at seed time) MUST match the order the
 * palette is served in — never reorder existing rows.
 */
export const colors = pgTable("colors", {
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
})
