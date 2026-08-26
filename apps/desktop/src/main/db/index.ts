import { app } from "electron"
import { join } from "node:path"
import Database from "better-sqlite3"
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import * as schema from "./schema"

/** The Drizzle-wrapped SQLite database. Uninitialized until {@link initDb}
 *  runs (the Electron main process calls it in `app.whenReady`). */
export let db!: BetterSQLite3Database<typeof schema>

/** Directory holding the Drizzle migration SQL files (copied into the bundle
 *  by the Forge `packageAfterCopy` hook; in dev they live in the repo). The
 *  files end up inside the asar, so both dev and packaged resolve from the
 *  app path (Electron's fs can read SQL files from the asar). */
function migrationsDir(): string {
  return join(app.getAppPath(), "drizzle")
}

/**
 * Open the Drizzle-wrapped SQLite database at userData/pindou.db and apply
 * pending migrations. Must run after `app.whenReady` (userData path is only
 * available then); call it once from the main entry point.
 */
export function initDb(): BetterSQLite3Database<typeof schema> {
  if (db) return db
  const sqlite = new Database(join(app.getPath("userData"), "pindou.db"))
  sqlite.pragma("journal_mode = WAL")
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: migrationsDir() })
  return db
}

export { schema }
