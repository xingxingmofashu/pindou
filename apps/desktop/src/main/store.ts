import { app } from "electron"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { getDb } from "../db"
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

/** Map a Drizzle row (snake_case columns) to the camelCase {@link PatternMeta}. */
function rowToMeta(row: typeof patterns.$inferSelect): PatternMeta {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    fkBrandId: row.fkBrandId,
    gridKey: row.gridKey,
    beadStats: row.beadStats,
    thumbUrl: row.thumbUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export const store = {
  async list(): Promise<PatternMeta[]> {
    const rows = await getDb()
      .select()
      .from(patterns)
      .orderBy(patterns.updatedAt, "desc")
    return rows.map(rowToMeta)
  },

  async get(id: string): Promise<PatternRecord | null> {
    const row = await getDb().select().from(patterns).where(eq(patterns.id, id)).get()
    if (!row) return null
    const grid = JSON.parse(
      await readFile(join(patternDir(id), GRID_FILE), "utf8"),
    ) as string[][]
    return { ...rowToMeta(row), grid }
  },

  async create(input: CreatePatternInput): Promise<PatternMeta> {
    const id = randomUUID()
    const now = new Date().toISOString()
    const meta: PatternMeta = {
      id,
      title: input.title ?? "",
      description: input.description ?? "",
      fkBrandId: input.fkBrandId,
      gridKey: GRID_FILE,
      beadStats: input.beadStats ?? "{}",
      thumbUrl: "",
      createdAt: now,
      updatedAt: now,
    }
    const dir = patternDir(id)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, GRID_FILE), JSON.stringify(input.grid), "utf8")
    await getDb().insert(patterns).values(meta)
    return meta
  },

  async update(id: string, input: UpdatePatternInput): Promise<PatternMeta> {
    const existing = await getDb().select().from(patterns).where(eq(patterns.id, id)).get()
    if (!existing) throw new Error(`pattern ${id} not found`)
    if (input.grid) {
      await writeFile(join(patternDir(id), GRID_FILE), JSON.stringify(input.grid), "utf8")
    }
    const meta: PatternMeta = {
      ...rowToMeta(existing),
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      fkBrandId: input.fkBrandId ?? existing.fkBrandId,
      beadStats: input.beadStats ?? existing.beadStats,
      updatedAt: new Date().toISOString(),
    }
    await getDb()
      .update(patterns)
      .set(meta)
      .where(eq(patterns.id, id))
    return meta
  },

  async remove(id: string): Promise<void> {
    await getDb().delete(patterns).where(eq(patterns.id, id))
    await rm(patternDir(id), { recursive: true, force: true })
  },
}
