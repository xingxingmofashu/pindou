import sharp from "sharp"
import { EMPTY } from "@/lib/editor/data"
import { MIN_PX } from "@/lib/editor/render"
import type { BeadPalette } from "@/types/palette"

/** Maximum cells per axis before downsampling kicks in. */
const MAX_CELLS = 48
/** Fixed output square side in pixels. */
const SIZE = MAX_CELLS * MIN_PX

/**
 * Generate a fixed-size base64-encoded PNG thumbnail.
 *
 * Every thumbnail is {@link SIZE}×{@link SIZE} pixels. The grid is
 * nearest-neighbour downsampled if it exceeds {@link MAX_CELLS} cells
 * per axis; otherwise each cell is scaled up to fill the canvas.
 * Background is #fafafa (editor canvas colour).
 */
export async function generateThumbnail(grid: number[][], palette: BeadPalette): Promise<string> {
  const h = grid.length
  const w = grid[0]?.length ?? 0
  if (h === 0 || w === 0) return ""

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
      const rgb = parseInt(hex.replace("#", ""), 16)
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

  return png.toString("base64")
}
