import { index, sqliteTable, text } from "drizzle-orm/sqlite-core"

/**
 * Desktop `patterns` table — mirrors the web app's `patterns` table
 * (apps/web/src/db/schema.ts) column-for-column, minus the auth-only
 * `fk_user_id`/`author_name` columns (the desktop app has no login).
 * `fk_brand_id` holds the brand uuid from the bundled palette catalog (same
 * ids the web DB uses), so rows stay interchangeable between the stores.
 * Grid JSON lives on the filesystem; the DB stores only the file key.
 */
export const patterns = sqliteTable(
  "patterns",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    gridKey: text("grid_key").notNull().default(""),
    fkBrandId: text("fk_brand_id").notNull(),
    beadStats: text("bead_stats").notNull().default("{}"),
    thumbUrl: text("thumb_url").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_patterns_updated_at").on(t.updatedAt)],
)
