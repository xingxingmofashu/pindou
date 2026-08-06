import sharp from "sharp"
import { EMPTY, MIN_PX } from "@/lib/editor"
import { hexToRgb } from "@/lib/utils"
import { R2 } from "@/lib/r2"
import type { Palette } from "@/types"

/** R2 client for this module's uploads. */
const r2 = new R2()

/** Maximum cells per axis before downsampling kicks in. */
const MAX_CELLS = 48
/** Fixed output square side in pixels. */
const SIZE = MAX_CELLS * MIN_PX
/** Object-key prefix under which thumbnails are stored in the R2 bucket. */
const KEY_PREFIX = "thumbnails"

/**
 * Generate a fixed-size PNG thumbnail.
 *
 * Every thumbnail is {@link SIZE}×{@link SIZE} pixels. The grid is
 * nearest-neighbour downsampled if it exceeds {@link MAX_CELLS} cells
 * per axis; otherwise each cell is scaled up to fill the canvas.
 * Background is #fafafa (editor canvas colour).
 *
 * @param grid    - The serialized grid (`grid[row][col]`, 0 = empty).
 * @param palette - Palette used to resolve index → colour hex.
 * @returns The encoded PNG bytes, or null for an empty grid.
 */
export async function generate(grid: number[][], palette: Palette): Promise<Buffer | null> {
  const h = grid.length
  const w = grid[0]?.length ?? 0
  if (h === 0 || w === 0) return null

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
      const colorIdx = srcRow[c * step] ?? EMPTY
      if (colorIdx === EMPTY) continue
      const hex = palette.colors[colorIdx - 1]?.hex
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
 * The object is stored at `thumbnails/{patternId}.png` via the generic R2
 * uploader. This is a hard dependency of publishing — the caller must treat a
 * thrown error as a failed publish.
 *
 * @param png       - The encoded PNG bytes to upload.
 * @param patternId - The pattern's uuid, used as the object key.
 * @returns The public URL: `{NEXT_R2_PUBLIC_URL}/thumbnails/{patternId}.png`.
 */
export async function upload(png: Buffer, patternId: string): Promise<string> {
  const key = `${KEY_PREFIX}/${patternId}.png`
  await r2.upload(key, png, "image/png")
  return `${process.env.NEXT_R2_PUBLIC_URL}/${key}`
}
