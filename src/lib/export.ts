import type { Palette } from "@/types"

/** Default pixels per bead when the caller doesn't specify a scale. */
export const DEFAULT_EXPORT_SCALE = 128

/**
 * Largest canvas dimension in pixels. Caps memory on pathological grids
 * (MAX_GRID_DIMENSION allows 4096×4096) and keeps the canvas within the
 * browser's practical limit (16384 per side).
 */
const MAX_EXPORT_DIM = 16384

/** Grid-line colour between beads. */
const GRID_LINE_COLOR = "#d4d4d8"

/** Axis-label colour. */
const LABEL_COLOR = "#52525b"

/** Bead colour-code label fill — matches the editor's label style. */
const BEAD_LABEL_COLOR = "#111"

/** Shaded background for the top/left coordinate bands. */
const HEADER_BG = "#f4f4f5"

/** Divider between the coordinate bands and the bead area. */
const HEADER_DIVIDER = "#a1a1aa"

/** Export options. */
export interface ExportGridOptions {
  /** Draw each bead's colour code (e.g. "A1") centred in the cell. */
  showLabels?: boolean
}

/** Bead-area geometry shared by rendering and size previews. */
export interface ExportLayout {
  /** Effective pixels per bead (scale, clamped to the canvas limit). */
  s: number
  /** Coordinate-number font size in pixels. */
  numFont: number
  /** Left coordinate-band width in pixels. */
  headerW: number
  /** Top coordinate-band height in pixels. */
  headerH: number
  /** Full canvas width in pixels. */
  width: number
  /** Full canvas height in pixels. */
  height: number
}

function computeLayout(cols: number, rows: number, scale: number): ExportLayout {
  const upper = Math.max(1, Math.min(scale, Math.floor(MAX_EXPORT_DIM / Math.max(cols, rows))))

  // Coordinate numbers are sized to fit a bead-sized header cell; the top band
  // is one bead tall so the header tiles with the grid. The left band is as
  // wide as the row numbers need. width/height grow monotonically with s, so
  // binary-search the largest s whose full canvas (bands + padding included)
  // fits the limit — clamping only the bead area would overflow the canvas.
  const dims = (s: number) => {
    const numFont = Math.max(4, Math.round(s * 0.6))
    const headerW = Math.ceil(String(rows).length * numFont * 0.7) + s
    const headerH = s
    return { numFont, headerW, headerH, width: headerW + cols * s + s, height: headerH + rows * s + s }
  }
  let lo = 1
  let hi = upper
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const { width, height } = dims(mid)
    if (width <= MAX_EXPORT_DIM && height <= MAX_EXPORT_DIM) lo = mid
    else hi = mid - 1
  }
  return { s: lo, ...dims(lo) }
}

/**
 * Full exported image size for a grid and scale, plus the effective scale.
 *
 * @param grid  - The serialized grid (`grid[row][col]`, 0 = empty).
 * @param scale - Pixels per bead (clamped so the full canvas fits the limit).
 * @returns The canvas width/height and the effective (clamped) pixels-per-bead,
 *          or null for an empty grid.
 */
export function exportGridSize(
  grid: number[][],
  scale: number,
): { width: number; height: number; scale: number } | null {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  if (rows === 0 || cols === 0) return null
  const { s, width, height } = computeLayout(cols, rows, scale)
  return { width, height, scale: s }
}

/**
 * Render a serialized bead grid to a PNG chart and trigger a download.
 *
 * The output is a pattern chart: a white background, light grid lines, and
 * 1‑based row/column coordinates in shaded header bands along the top and left
 * edges. The header bands are drawn as part of the grid — grid lines run through
 * them and each header cell matches a bead's size, so coordinates align with the
 * beads they label. Each bead is drawn as a solid `scale × scale` pixel square
 * with no canvas scaling, so the beads stay pixel-perfect (no antialiasing).
 * With {@link ExportGridOptions.showLabels}, each bead also gets its colour code
 * centred on it. The effective scale is clamped so the full canvas never exceeds
 * {@link MAX_EXPORT_DIM} on either side (coordinate bands and padding counted).
 *
 * @param grid    - The serialized grid (`grid[row][col]`, 0 = empty).
 * @param palette - Palette used to resolve index → colour hex.
 * @param scale   - Pixels per bead (integer; clamped to fit the canvas limit).
 * @param opts    - Optional export options.
 */
export function exportGridPng(
  grid: number[][],
  palette: Palette,
  scale = DEFAULT_EXPORT_SCALE,
  opts: ExportGridOptions = {},
): void {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  if (rows === 0 || cols === 0) return

  const layout = computeLayout(cols, rows, scale)
  const { s, numFont, headerW, headerH } = layout

  const canvas = document.createElement("canvas")
  canvas.width = layout.width
  canvas.height = layout.height
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Shade the top and left coordinate bands so they read as part of the grid
  // (the corner where the bands meet is covered twice, harmlessly).
  ctx.fillStyle = HEADER_BG
  ctx.fillRect(0, 0, canvas.width, headerH)
  ctx.fillRect(0, 0, headerW, canvas.height)

  for (let r = 0; r < rows; r++) {
    const row = grid[r]
    for (let c = 0; c < cols; c++) {
      const val = row[c]
      if (val <= 0) continue
      const color = palette.colors[val - 1]
      if (!color) continue
      ctx.fillStyle = color.hex
      ctx.fillRect(headerW + c * s, headerH + r * s, s, s)
    }
  }

  // Grid lines run through the coordinate bands and over the beads (matches
  // the editor's grid-over-beads layer order) so header cells and data cells
  // align and every boundary stays visible.
  ctx.strokeStyle = GRID_LINE_COLOR
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let c = 0; c <= cols; c++) {
    const x = headerW + c * s + 0.5
    ctx.moveTo(x, 0)
    ctx.lineTo(x, headerH + rows * s)
  }
  for (let r = 0; r <= rows; r++) {
    const y = headerH + r * s + 0.5
    ctx.moveTo(0, y)
    ctx.lineTo(headerW + cols * s, y)
  }
  ctx.stroke()

  // A slightly darker divider separates the coordinate bands from the beads.
  ctx.strokeStyle = HEADER_DIVIDER
  ctx.beginPath()
  ctx.moveTo(headerW + 0.5, 0)
  ctx.lineTo(headerW + 0.5, headerH + rows * s)
  ctx.moveTo(0, headerH + 0.5)
  ctx.lineTo(headerW + cols * s, headerH + 0.5)
  ctx.stroke()

  // Colour-code labels on each bead (mirrors the editor's Labels toggle).
  if (opts.showLabels) {
    ctx.fillStyle = BEAD_LABEL_COLOR
    ctx.font = `${Math.max(4, Math.round(s * 0.4))}px ui-monospace, monospace`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    // Widths depend only on the code (the font is fixed), so measure each once.
    const labelWidths = new Map<string, number>()
    for (let r = 0; r < rows; r++) {
      const row = grid[r]
      for (let c = 0; c < cols; c++) {
        const val = row[c]
        if (val <= 0) continue
        const color = palette.colors[val - 1]
        if (!color) continue
        const label = color.code
        let width = labelWidths.get(label)
        if (width === undefined) {
          width = ctx.measureText(label).width
          labelWidths.set(label, width)
        }
        if (width > s) continue
        ctx.fillText(label, headerW + (c + 0.5) * s, headerH + (r + 0.5) * s)
      }
    }
  }

  // Column numbers centred in their header cells along the top, row numbers
  // centred in theirs down the left. Column labels are skipped when they can't
  // fit one per column (they'd overlap).
  ctx.fillStyle = LABEL_COLOR
  ctx.font = `${numFont}px ui-monospace, monospace`
  ctx.textBaseline = "middle"
  ctx.textAlign = "center"
  for (let c = 0; c < cols; c++) {
    const label = String(c + 1)
    if (ctx.measureText(label).width > s) continue
    ctx.fillText(label, headerW + (c + 0.5) * s, headerH / 2)
  }
  for (let r = 0; r < rows; r++) {
    ctx.fillText(String(r + 1), headerW / 2, headerH + (r + 0.5) * s)
  }

  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `pattern-${cols}x${rows}@${s}x.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, "image/png")
}
