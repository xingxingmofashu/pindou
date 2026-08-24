import { eq, desc } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import { db } from "./db"
import { patterns } from "./db/schema"
import { GridStorage } from "./storage/grid-storage"
import { ThumbnailStorage } from "./storage/thumbnail-storage"
import { PALETTES } from "@pindou/shared/palettes"
import type { Palette } from "@pindou/shared/types"
import type {
  CreatePatternInput,
  PatternMeta,
  PatternRecord,
  UpdatePatternInput,
} from "../shared/types"

/** Resolve the bundled brand palette for a fk_brand_id (uuid). */
function paletteOf(fkBrandId: string): Palette {
  const brand = PALETTES.find((b) => b.id === fkBrandId)
  if (!brand) throw new Error(`unknown brand ${fkBrandId}`)
  return brand
}

/**
 * Pattern store: metadata lives in SQLite (via Drizzle), grid JSON + thumbnail
 * PNG on disk via {@link GridStorage}/{@link ThumbnailStorage} — the same
 * split as the web app (DB row + R2 objects). better-sqlite3 queries are
 * synchronous, so no `await` on them.
 */
const grids = new GridStorage()
const thumbs = new ThumbnailStorage()

/** Render + store a thumbnail for a grid. Best-effort: returns "" on any
 *  failure so a render problem never loses the pattern. */
async function thumbnailFor(
  id: string,
  grid: string[][],
  brandId: string,
): Promise<string> {
  try {
    const png = await thumbs.generate(grid, paletteOf(brandId))
    return png ? await thumbs.upload(png, id) : ""
  } catch {
    return ""
  }
}

/** Garbage-collect a pattern's superseded files (old grid + thumbnail). */
function gcFiles(gridKey: string, thumbUrl: string): Promise<void> {
  return Promise.allSettled([
    gridKey ? grids.delete(gridKey) : Promise.resolve(),
    thumbUrl ? thumbs.delete(thumbUrl) : Promise.resolve(),
  ]).then(() => undefined)
}

export const store = {
  list(): PatternMeta[] {
    return db.select().from(patterns).orderBy(desc(patterns.updatedAt)).all()
  },

  async get(id: string): Promise<PatternRecord | null> {
    const row = db.select().from(patterns).where(eq(patterns.id, id)).get()
    if (!row) return null
    const grid = await grids.get(row.gridKey)
    if (!grid) return null
    return { ...row, grid }
  },

  /** Read a pattern's thumbnail as a data URL, or null when missing. */
  async thumbnail(id: string): Promise<string | null> {
    const row = db.select().from(patterns).where(eq(patterns.id, id)).get()
    if (!row?.thumbUrl) return null
    return thumbs.readDataUrl(row.thumbUrl)
  },

  async create(input: CreatePatternInput): Promise<PatternMeta> {
    const now = new Date().toISOString()
    const row: PatternMeta = {
      id: randomUUID(),
      title: input.title ?? "",
      description: input.description ?? "",
      fkBrandId: input.fkBrandId,
      gridKey: "",
      beadStats: input.beadStats ?? "{}",
      thumbUrl: "",
      createdAt: now,
      updatedAt: now,
    }
    // Write the grid first; only insert the DB row if the file landed.
    row.gridKey = await grids.upload(row.id, input.grid)
    row.thumbUrl = await thumbnailFor(row.id, input.grid, input.fkBrandId)
    db.insert(patterns).values(row).run()
    return row
  },

  async update(id: string, input: UpdatePatternInput): Promise<PatternMeta> {
    const existing = db.select().from(patterns).where(eq(patterns.id, id)).get()
    if (!existing) throw new Error(`pattern ${id} not found`)

    // Upload the new grid to a fresh key before touching the DB, then
    // garbage-collect the superseded files after a successful update.
    const row: PatternMeta = {
      ...existing,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      fkBrandId: input.fkBrandId ?? existing.fkBrandId,
      beadStats: input.beadStats ?? existing.beadStats,
      updatedAt: new Date().toISOString(),
    }
    if (input.grid) {
      row.gridKey = await grids.upload(id, input.grid)
      row.thumbUrl = await thumbnailFor(id, input.grid, row.fkBrandId)
    }
    db.update(patterns).set(row).where(eq(patterns.id, id)).run()
    if (input.grid) void gcFiles(existing.gridKey, existing.thumbUrl)
    return row
  },

  async remove(id: string): Promise<void> {
    const row = db.select().from(patterns).where(eq(patterns.id, id)).get()
    db.delete(patterns).where(eq(patterns.id, id)).run()
    if (row) await gcFiles(row.gridKey, row.thumbUrl)
    // Remove the now-empty pattern directories.
    await Promise.allSettled([grids.removePatternDir(id), thumbs.removePatternDir(id)])
  },
}
