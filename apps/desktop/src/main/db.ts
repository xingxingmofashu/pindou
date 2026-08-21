import { app } from "electron"
import { join } from "node:path"
import Database from "better-sqlite3"
import type { PatternMeta } from "../shared/types"

let db: Database.Database | null = null

/** Patterns table DDL — mirrors the web app's `patterns` table (minus auth). */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS patterns (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  brand_code  TEXT NOT NULL,
  grid_key    TEXT NOT NULL,
  thumb_path  TEXT,
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
    brandCode: String(row.brand_code),
    gridKey: String(row.grid_key),
    thumbPath: row.thumb_path ? String(row.thumb_path) : null,
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
        `INSERT INTO patterns (id, title, description, brand_code, grid_key, thumb_path, created_at, updated_at)
         VALUES (@id, @title, @description, @brandCode, @gridKey, @thumbPath, @createdAt, @updatedAt)`,
      )
      .run(meta)
  },

  update(meta: PatternMeta): void {
    getDb()
      .prepare(
        `UPDATE patterns
         SET title = @title, description = @description, brand_code = @brandCode,
             grid_key = @gridKey, thumb_path = @thumbPath, updated_at = @updatedAt
         WHERE id = @id`,
      )
      .run(meta)
  },

  remove(id: string): void {
    getDb().prepare("DELETE FROM patterns WHERE id = ?").run(id)
  },
}
