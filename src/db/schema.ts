import { pgTable, text } from "drizzle-orm/pg-core"

export const patterns = pgTable("patterns", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  authorName: text("author_name"),
  /** Dense 2D grid serialized as JSON: number[][] — 0 = empty, ≥1 = palette index */
  gridData: text("grid_data").notNull(),
  brandId: text("brand_id").notNull().default("mard"),
  beadStats: text("bead_stats").notNull().default("{}"),
  /** PNG thumbnail (base64) generated server-side on publish. */
  thumbPng: text("thumb_png").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})
