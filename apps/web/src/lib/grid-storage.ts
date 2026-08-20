import { R2 } from "@/lib/r2"

/**
 * Object-key prefix under which pattern grids are stored in the R2 bucket.
 * The folder must exist in the bucket (e.g. `patterns/`).
 */
const KEY_PREFIX = "patterns"

/**
 * Stores pattern grids in Cloudflare R2 as JSON objects.
 *
 * The `patterns.grid_key` column holds the object key; the grid JSON itself
 * never touches Postgres, keeping the database small. Grids are a hard
 * dependency of publish/edit (write) and pattern detail (read) — the caller
 * must treat a thrown error as a failure.
 *
 * Every upload writes to a **fresh** key (`patterns/{id}/{uuid}.json`), never
 * overwriting the previous object. That way a failed DB write can roll back by
 * deleting only the new object, leaving the previously published grid intact.
 */
export class GridStorage {
  private readonly r2 = new R2()

  /**
   * Serialize a grid to JSON and upload it to R2 under a new versioned key.
   *
   * @param id   - The pattern's uuid, used in the object key.
   * @param grid - The code grid (`grid[row][col]`, "" = empty).
   * @returns The object key, to be stored in `patterns.grid_key`.
   */
  async upload(id: string, grid: string[][]): Promise<string> {
    const key = `${KEY_PREFIX}/${id}/${crypto.randomUUID()}.json`
    const body = Buffer.from(JSON.stringify(grid), "utf-8")
    await this.r2.upload(key, body, "application/json")
    return key
  }

  /**
   * Fetch and parse a grid from R2.
   *
   * @param key - The object key (as stored in `patterns.grid_key`).
   * @returns The parsed code grid, or null when the object is missing.
   */
  async get(key: string): Promise<string[][] | null> {
    const body = await this.r2.get(key)
    if (!body) return null
    return JSON.parse(body.toString("utf-8")) as string[][]
  }

  /**
   * Delete a grid object from R2. Used to roll back an upload whose DB write
   * failed, or to garbage-collect the previous grid after a successful edit.
   * Fails silently if the key is empty.
   *
   * @param key - The object key to delete.
   */
  async delete(key: string): Promise<void> {
    if (!key) return
    await this.r2.delete(key)
  }
}
