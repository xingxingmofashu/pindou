import { app } from "electron"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { randomUUID } from "node:crypto"

/** Root directory holding every pattern's grid files (under userData). */
function storageRoot(): string {
  return join(app.getPath("userData"), "patterns")
}

/** Absolute path for a relative storage key (`patterns/{id}/{uuid}.json`). */
function resolveKey(key: string): string {
  return join(storageRoot(), key)
}

/**
 * Stores pattern grids as JSON files on disk — the desktop analogue of the
 * web app's R2-backed {@link GridStorage} (packages/core/src/server/grid-storage.ts).
 *
 * The `patterns.grid_key` column holds a **relative** key
 * (`patterns/{id}/{uuid}.json`); the grid JSON itself never touches SQLite.
 * Every upload writes to a fresh key, never overwriting the previous object,
 * so a failed DB write can roll back by deleting only the new key — leaving
 * the previously saved grid intact.
 */
export class GridStorage {
  /**
   * Serialize a grid to JSON and write it under a new versioned key.
   *
   * @param id   - The pattern's uuid, used in the key.
   * @param grid - The code grid (`grid[row][col]`, "" = empty).
   * @returns The relative key, to be stored in `patterns.grid_key`.
   */
  async upload(id: string, grid: string[][]): Promise<string> {
    const key = `patterns/${id}/${randomUUID()}.json`
    const abs = resolveKey(key)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, JSON.stringify(grid), "utf8")
    return key
  }

  /**
   * Fetch and parse a grid from disk.
   *
   * @param key - The relative key (as stored in `patterns.grid_key`).
   * @returns The parsed code grid, or null when the file is missing.
   */
  async get(key: string): Promise<string[][] | null> {
    try {
      const raw = await readFile(resolveKey(key), "utf8")
      return JSON.parse(raw) as string[][]
    } catch {
      return null
    }
  }

  /**
   * Delete a grid file. Used to roll back an upload whose DB write failed, or
   * to garbage-collect the previous grid after a successful edit. Fails
   * silently if the key is empty.
   *
   * @param key - The relative key to delete.
   */
  async delete(key: string): Promise<void> {
    if (!key) return
    await rm(resolveKey(key), { force: true })
  }

  /**
   * Remove a pattern's whole directory (all its versioned grid files). Called
   * when a pattern is deleted, so no orphaned files are left behind.
   *
   * @param id - The pattern's uuid.
   */
  async removePatternDir(id: string): Promise<void> {
    await rm(join(storageRoot(), id), { recursive: true, force: true })
  }
}
