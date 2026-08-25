import { app } from "electron"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { randomUUID } from "node:crypto"
import sharp from "sharp"
import { buildHexByCode, gridSize } from "@pindou/core/editor"
import { EDITOR_BG } from "@pindou/shared/constants"
import { hexToRgb } from "@pindou/core/utils"
import type { Palette } from "@pindou/shared/types"

/** Maximum cells per axis before downsampling kicks in. */
const MAX_CELLS = 48
/** Fixed output square side in pixels. */
const SIZE = 128
/** Key prefix under which thumbnails are stored (relative to userData). */
const KEY_PREFIX = "thumbnails"

/** Root directory holding every pattern's thumbnail files (under userData). */
function storageRoot(): string {
  return app.getPath("userData")
}

/** Absolute path for a relative storage key (`thumbnails/{id}/{uuid}.png`). */
function resolveKey(key: string): string {
  return join(storageRoot(), key)
}

/**
 * Renders bead-grid thumbnails to PNG files on disk — the desktop analogue of
 * the web app's {@link Thumbnail} (packages/core/src/server/thumbnail.ts),
 * with file-system storage instead of R2.
 *
 * `patterns.thumb_url` holds a **relative** key
 * (`thumbnails/{patternId}/{uuid}.png`); every render writes a fresh key so a
 * failed DB write can roll back by deleting only the new file, and the
 * superseded thumbnail is garbage-collected after a successful edit.
 */
export class ThumbnailStorage {
  /**
   * Generate a fixed-size PNG thumbnail. Mirrors the web implementation:
   * {@link SIZE}×{@link SIZE} pixels, nearest-neighbour downsampled when the
   * grid exceeds {@link MAX_CELLS} cells per axis, editor background fill.
   *
   * @param grid    - The serialized code grid (`grid[row][col]`, "" = empty).
   * @param palette - Palette used to resolve colour code → hex.
   * @returns The encoded PNG bytes, or null for an empty grid.
   */
  async generate(grid: string[][], palette: Palette): Promise<Buffer | null> {
    const size = gridSize(grid)
    if (!size) return null
    const { rows: h, cols: w } = size

    const hexByCode = buildHexByCode(palette)

    const step = Math.ceil(Math.max(h, w) / MAX_CELLS)
    const cellsH = Math.ceil(h / step)
    const cellsW = Math.ceil(w / step)

    // Scale cell pixel size so the pattern fills the square
    const cellPx = Math.floor(SIZE / Math.max(cellsH, cellsW))
    const totalW = cellsW * cellPx
    const totalH = cellsH * cellPx
    const offsetX = Math.floor((SIZE - totalW) / 2)
    const offsetY = Math.floor((SIZE - totalH) / 2)

    const rgba = Buffer.alloc(SIZE * SIZE * 4)
    const bg = hexToRgb(EDITOR_BG)
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = (bg >> 16) & 0xff
      rgba[i + 1] = (bg >> 8) & 0xff
      rgba[i + 2] = bg & 0xff
      rgba[i + 3] = 0xff
    }

    for (let r = 0; r < cellsH; r++) {
      const srcRow = grid[r * step]
      if (!srcRow) continue
      for (let c = 0; c < cellsW; c++) {
        const code = srcRow[c * step] ?? ""
        if (code === "") continue
        const hex = hexByCode.get(code)
        if (!hex) continue
        const rgb = hexToRgb(hex)
        const y0 = offsetY + r * cellPx
        const x0 = offsetX + c * cellPx
        for (let dr = 0; dr < cellPx; dr++) {
          const rowStart = ((y0 + dr) * SIZE + x0) * 4
          for (let dc = 0; dc < cellPx; dc++) {
            const i = rowStart + dc * 4
            rgba[i] = (rgb >> 16) & 0xff
            rgba[i + 1] = (rgb >> 8) & 0xff
            rgba[i + 2] = rgb & 0xff
            rgba[i + 3] = 255
          }
        }
      }
    }

    return sharp(rgba, {
      raw: { width: SIZE, height: SIZE, channels: 4 },
    })
      .png()
      .toBuffer()
  }

  /**
   * Write a thumbnail PNG under a new versioned key.
   *
   * @param png       - The encoded PNG bytes.
   * @param patternId - The pattern's uuid, used in the key.
   * @returns The relative key, to be stored in `patterns.thumb_url`.
   */
  async upload(png: Buffer, patternId: string): Promise<string> {
    const name = `${randomUUID()}.png`
    const key = `${KEY_PREFIX}/${patternId}/${name}`
    const abs = resolveKey(key)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, png)
    return key
  }

  /**
   * Read a thumbnail file as a base64 data URL, or null when missing.
   *
   * @param key - The relative key (as stored in `patterns.thumb_url`).
   */
  async readDataUrl(key: string): Promise<string | null> {
    if (!key) return null
    try {
      const buf = await readFile(resolveKey(key))
      return `data:image/png;base64,${buf.toString("base64")}`
    } catch {
      return null
    }
  }

  /**
   * Delete a thumbnail file. Fails silently if the key is empty or the file
   * doesn't exist.
   *
   * @param key - The relative key to delete.
   */
  async delete(key: string): Promise<void> {
    if (!key) return
    await rm(resolveKey(key), { force: true })
  }

  /**
   * Remove a pattern's whole thumbnail directory (all its versioned files).
   * Called when a pattern is deleted.
   *
   * @param id - The pattern's uuid.
   */
  async removePatternDir(id: string): Promise<void> {
    await rm(resolveKey(`${KEY_PREFIX}/${id}`), { recursive: true, force: true })
  }
}
