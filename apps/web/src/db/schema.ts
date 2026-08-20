import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { users } from "./auth-schema"

export const patterns = pgTable("patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  authorName: text("author_name"),
  /**
   * R2 object key holding the grid JSON (`patterns/{id}/{uuid}.json`); the
   * grid itself is never stored in Postgres. Empty until the grid is written.
   */
  gridKey: text("grid_key").notNull().default(""),
  /** Brand UUID referencing brands.id; code→uuid mapping lives in the app layer. */
  fkBrandId: uuid("fk_brand_id").notNull().references(() => brands.id),
  /** Owning Better Auth user (set server-side on publish); NULL if the account is deleted. */
  fkUserId: text("fk_user_id").references(() => users.id, { onDelete: "set null" }),
  beadStats: text("bead_stats").notNull().default("{}"),
  /** Public thumbnail URL (Cloudflare R2), generated server-side on publish. */
  thumbUrl: text("thumb_url").notNull().default(""),
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
 * Zod wire schemas, shared types and validation moved to `@pindou/shared`
 * (database-agnostic). Re-exported here so existing `@/db/schema` imports
 * keep working; the drizzle table definitions above remain web-specific.
 */
export * from "@pindou/shared/schema"

export * from "./auth-schema"
