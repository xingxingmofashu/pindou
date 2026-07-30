import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"

const sqlite = new Database(".data/pindou.db")
sqlite.pragma("journal_mode = WAL")
sqlite.pragma("foreign_keys = ON")

export const db = drizzle(sqlite)
