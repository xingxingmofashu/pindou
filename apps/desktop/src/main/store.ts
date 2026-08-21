import { app } from "electron"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { patternQueries } from "./db"
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
const THUMB_FILE = "thumb.png"

export const store = {
  async list(): Promise<PatternMeta[]> {
    return patternQueries.list()
  },

  async get(id: string): Promise<PatternRecord | null> {
    const meta = patternQueries.get(id)
    if (!meta) return null
    const grid = JSON.parse(
      await readFile(join(patternDir(id), GRID_FILE), "utf8"),
    ) as string[][]
    return { ...meta, grid }
  },

  async create(input: CreatePatternInput): Promise<PatternMeta> {
    const id = randomUUID()
    const now = new Date().toISOString()
    const meta: PatternMeta = {
      id,
      title: input.title ?? "",
      description: input.description ?? "",
      brandCode: input.brandCode,
      gridKey: GRID_FILE,
      thumbPath: null,
      createdAt: now,
      updatedAt: now,
    }
    const dir = patternDir(id)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, GRID_FILE), JSON.stringify(input.grid), "utf8")
    patternQueries.insert(meta)
    return meta
  },

  async update(id: string, input: UpdatePatternInput): Promise<PatternMeta> {
    const existing = patternQueries.get(id)
    if (!existing) throw new Error(`pattern ${id} not found`)
    if (input.grid) {
      await writeFile(join(patternDir(id), GRID_FILE), JSON.stringify(input.grid), "utf8")
    }
    const meta: PatternMeta = {
      ...existing,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      brandCode: input.brandCode ?? existing.brandCode,
      updatedAt: new Date().toISOString(),
    }
    patternQueries.update(meta)
    return meta
  },

  async remove(id: string): Promise<void> {
    patternQueries.remove(id)
    await rm(patternDir(id), { recursive: true, force: true })
  },
}
