import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const patterns = sqliteTable("patterns", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  authorName: text("author_name"),
  /** Dense 2D grid serialized as JSON: number[][] — 0 = empty, ≥1 = palette index */
  gridData: text("grid_data").notNull(),
  brandId: text("brand_id").notNull().default("mard"),
  beadStats: text("bead_stats").notNull().default("{}"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
})
