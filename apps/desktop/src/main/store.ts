import { app } from "electron"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { eq, desc } from "drizzle-orm"
import { db } from "../db"
import { patterns } from "../db/schema"
import type {
  CreatePatternInput,
  PatternMeta,
  PatternRecord,
  UpdatePatternInput,
} from "../shared/types"

/** Root dir holding each pattern's grid + thumbnail files. */
function patternsDir(): string {
  return join(app.getPath("userData"), "patterns")
}

function patternDir(id: string): string {
  return join(patternsDir(), id)
}

const GRID_FILE = "grid.json"

/** Persist a pattern's grid JSON to disk under its id directory. */
async function writeGrid(id: string, grid: string[][]): Promise<void> {
  await mkdir(patternDir(id), { recursive: true })
  await writeFile(join(patternDir(id), GRID_FILE), JSON.stringify(grid), "utf8")
}

/** Read a pattern's grid JSON back from disk. */
async function readGrid(id: string): Promise<string[][]> {
  return JSON.parse(await readFile(join(patternDir(id), GRID_FILE), "utf8")) as string[][]
}

/**
 * Pattern store: metadata lives in SQLite (via Drizzle), the grid JSON on the
 * filesystem. better-sqlite3 queries are synchronous, so no `await` on them.
 */
export const store = {
  list(): PatternMeta[] {
    return db.select().from(patterns).orderBy(desc(patterns.updatedAt)).all()
  },

  async get(id: string): Promise<PatternRecord | null> {
    const row = db.select().from(patterns).where(eq(patterns.id, id)).get()
    if (!row) return null
    return { ...row, grid: await readGrid(id) }
  },

  async create(input: CreatePatternInput): Promise<PatternMeta> {
    const now = new Date().toISOString()
    const row: PatternMeta = {
      id: randomUUID(),
      title: input.title ?? "",
      description: input.description ?? "",
      fkBrandId: input.fkBrandId,
      gridKey: GRID_FILE,
      beadStats: input.beadStats ?? "{}",
      thumbUrl: "",
      createdAt: now,
      updatedAt: now,
    }
    await writeGrid(row.id, input.grid)
    db.insert(patterns).values(row).run()
    return row
  },

  async update(id: string, input: UpdatePatternInput): Promise<PatternMeta> {
    const existing = db.select().from(patterns).where(eq(patterns.id, id)).get()
    if (!existing) throw new Error(`pattern ${id} not found`)
    if (input.grid) await writeGrid(id, input.grid)
    const row: PatternMeta = {
      ...existing,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      fkBrandId: input.fkBrandId ?? existing.fkBrandId,
      beadStats: input.beadStats ?? existing.beadStats,
      updatedAt: new Date().toISOString(),
    }
    db.update(patterns).set(row).where(eq(patterns.id, id)).run()
    return row
  },

  async remove(id: string): Promise<void> {
    db.delete(patterns).where(eq(patterns.id, id)).run()
    await rm(patternDir(id), { recursive: true, force: true })
  },
}
