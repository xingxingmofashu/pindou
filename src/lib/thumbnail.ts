import sharp from "sharp"
import { MIN_PX, buildHexByCode, gridSize } from "@/lib/editor"
import { hexToRgb } from "@/lib/utils"
import { R2 } from "@/lib/r2"
import type { Palette } from "@/types"

/** Maximum cells per axis before downsampling kicks in. */
const MAX_CELLS = 48
/** Fixed output square side in pixels. */
const SIZE = MAX_CELLS * MIN_PX
/** Object-key prefix under which thumbnails are stored in the R2 bucket. */
const KEY_PREFIX = "thumbnails"

/**
 * Renders bead-grid thumbnails to PNG and uploads them to Cloudflare R2.
 *
 * Uploads are a hard dependency of publishing — the caller must treat a thrown
 * error as a failed publish.
 */
export class Thumbnail {
  private readonly r2 = new R2()

  /**
   * Generate a fixed-size PNG thumbnail.
   *
   * Every thumbnail is {@link SIZE}×{@link SIZE} pixels. The grid is
   * nearest-neighbour downsampled if it exceeds {@link MAX_CELLS} cells
   * per axis; otherwise each cell is scaled up to fill the canvas.
   * Background is #fafafa (editor canvas colour).
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
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 0xfa
      rgba[i + 1] = 0xfa
      rgba[i + 2] = 0xfa
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

    const png = await sharp(rgba, {
      raw: { width: SIZE, height: SIZE, channels: 4 },
    })
      .png()
      .toBuffer()

    return png
  }

  /**
   * Upload a thumbnail PNG to Cloudflare R2 and return its public URL.
   *
   * The object key is fixed at `thumbnails/{patternId}.png`, so re-rendering
   * overwrites it in place. A `?v=` query param busts browser/CDN caches of
   * the immutable thumbnail whenever the pattern is re-rendered.
   *
   * @param png       - The encoded PNG bytes to upload.
   * @param patternId - The pattern's uuid, used as the object key.
   * @returns The public URL: `{NEXT_R2_PUBLIC_URL}/thumbnails/{patternId}.png?v={timestamp}`.
   * @throws If the public URL is not configured (caught by the caller as a
   *         failed publish).
   */
  async upload(png: Buffer, patternId: string): Promise<string> {
    const publicUrl = process.env.NEXT_R2_PUBLIC_URL
    if (!publicUrl) throw new Error("NEXT_R2_PUBLIC_URL is not configured")
    const key = `${KEY_PREFIX}/${patternId}.png`
    await this.r2.upload(key, png, "image/png")
    return `${publicUrl}/${key}?v=${Date.now()}`
  }

  /**
   * Delete a previously uploaded thumbnail object by its public URL.
   *
   * Used to roll back an upload whose DB write failed. Fails silently if the
   * URL isn't one of ours (e.g. not configured).
   *
   * @param url - The public URL returned by {@link upload}.
   */
  async delete(url: string): Promise<void> {
    const prefix = `${process.env.NEXT_R2_PUBLIC_URL}/`
    if (url.startsWith(prefix)) {
      await this.r2.delete(url.slice(prefix.length).split("?")[0])
    }
  }
}
