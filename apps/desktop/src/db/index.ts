import { app } from "electron"
import { join } from "node:path"
import Database from "better-sqlite3"
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import * as schema from "./schema"

let db: BetterSQLite3Database<typeof schema> | null = null

/** Directory holding the Drizzle migration SQL files (copied into the bundle
 *  by the `copyMigrations` build plugin; in dev they live in the repo). */
function migrationsDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "drizzle")
    : join(app.getAppPath(), "drizzle")
}

/**
 * Open (or return the cached) Drizzle-wrapped SQLite database at
 * userData/pindou.db and apply pending migrations. WAL keeps reads
 * non-blocking while the editor saves.
 */
export function getDb(): BetterSQLite3Database<typeof schema> {
  if (db) return db
  const sqlite = new Database(join(app.getPath("userData"), "pindou.db"))
  sqlite.pragma("journal_mode = WAL")
  db = drizzle(sqlite, { schema })
  // Apply Drizzle migrations. A pre-Drizzle database (the hand-written schema
  // from earlier versions) has a `patterns` table with the old `brand_code`
  // column and no migration tracking — Drizzle's CREATE TABLE would fail and
  // the columns differ anyway. This is pre-release data, so drop the legacy
  // table and let the migrations rebuild it with the current schema.
  const hasMigrations = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
    .get()
  if (!hasMigrations) {
    const legacy = sqlite
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'patterns'")
      .get() as { sql: string } | undefined
    if (legacy && !legacy.sql.includes("fk_brand_id")) {
      console.warn("[db] dropping legacy patterns table (pre-Drizzle schema)")
      sqlite.exec("DROP TABLE patterns")
    }
  }
  migrate(db, { migrationsFolder: migrationsDir() })
  return db
}

export { schema }
