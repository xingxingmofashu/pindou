import { app } from "electron"
import { join } from "node:path"
import Database from "better-sqlite3"
import type { PatternMeta } from "../shared/types"

let db: Database.Database | null = null

/**
 * Patterns table DDL — mirrors the web app's `patterns` table
 * (apps/web/src/db/schema.ts) column-for-column. `fk_brand_id` holds the
 * brand uuid from the bundled palette catalog (same ids the web DB uses), so
 * rows are interchangeable between the stores. Auth-only columns
 * (`fk_user_id`) and the DB-generated defaults are intentionally omitted or
 * handled in the app layer.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS patterns (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  grid_key    TEXT NOT NULL DEFAULT '',
  fk_brand_id TEXT NOT NULL,
  bead_stats  TEXT NOT NULL DEFAULT '{}',
  thumb_url   TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_patterns_updated_at ON patterns (updated_at DESC);
`

/** Open (or return the cached) SQLite database at userData/pindou.db. */
export function getDb(): Database.Database {
  if (db) return db
  const dbPath = join(app.getPath("userData"), "pindou.db")
  db = new Database(dbPath)
  db.pragma("journal_mode = WAL")
  db.exec(SCHEMA)
  return db
}

/** Map a DB row to a {@link PatternMeta}. */
function rowToMeta(row: Record<string, unknown>): PatternMeta {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description),
    fkBrandId: String(row.fk_brand_id),
    gridKey: String(row.grid_key),
    beadStats: String(row.bead_stats),
    thumbUrl: String(row.thumb_url),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export const patternQueries = {
  list(): PatternMeta[] {
    const rows = getDb()
      .prepare("SELECT * FROM patterns ORDER BY updated_at DESC")
      .all() as Record<string, unknown>[]
    return rows.map(rowToMeta)
  },

  get(id: string): PatternMeta | null {
    const row = getDb()
      .prepare("SELECT * FROM patterns WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined
    return row ? rowToMeta(row) : null
  },

  insert(meta: PatternMeta): void {
    getDb()
      .prepare(
        `INSERT INTO patterns (id, title, description, fk_brand_id, grid_key, bead_stats, thumb_url, created_at, updated_at)
         VALUES (@id, @title, @description, @fkBrandId, @gridKey, @beadStats, @thumbUrl, @createdAt, @updatedAt)`,
      )
      .run(meta)
  },

  update(meta: PatternMeta): void {
    getDb()
      .prepare(
        `UPDATE patterns
         SET title = @title, description = @description, fk_brand_id = @fkBrandId,
             grid_key = @gridKey, bead_stats = @beadStats, thumb_url = @thumbUrl,
             updated_at = @updatedAt
         WHERE id = @id`,
      )
      .run(meta)
  },

  remove(id: string): void {
    getDb().prepare("DELETE FROM patterns WHERE id = ?").run(id)
  },
}
