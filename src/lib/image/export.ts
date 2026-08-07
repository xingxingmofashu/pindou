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

/** Fixed geometry of the bead-usage list drawn beneath the pattern. */
const BEAD_STATS_TITLE_FONT = 12
const BEAD_STATS_FONT = 12
const BEAD_STATS_ROW_H = 18
const BEAD_STATS_SWATCH = 14
const BEAD_STATS_GAP = 6
const BEAD_STATS_PAD = 8

/** Export options. */
export interface ExportGridOptions {
  /** Draw each bead's colour code (e.g. "A1") centred in the cell. */
  showLabels?: boolean
  /** Append a bead-usage list (swatch, code, count) below the pattern. */
  showBeadStats?: boolean
  /** Title of the bead-usage list; falls back to "Beads used". */
  beadStatsTitle?: string
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
 * @param grid  - The serialized code grid (`grid[row][col]`, "" = empty).
 * @param scale - Pixels per bead (clamped so the full canvas fits the limit).
 * @param opts  - Optional export options (a bead-usage list grows the height).
 * @returns The canvas width/height and the effective (clamped) pixels-per-bead,
 *          or null for an empty grid.
 */
export function exportGridSize(
  grid: string[][],
  scale: number,
  opts: ExportGridOptions = {},
): { width: number; height: number; scale: number } | null {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  if (rows === 0 || cols === 0) return null
  const { s, width, height } = computeLayout(cols, rows, scale)
  if (!opts.showBeadStats) return { width, height, scale: s }
  const detail = beadStatsSize(usedColorCount(grid), width)
  return { width: detail.width, height: height + detail.height, scale: s }
}

/**
 * The distinct number of painted colours in a grid — the bead-usage list has
 * one row per colour.
 *
 * @param grid - The serialized code grid (`grid[row][col]`, "" = empty).
 * @returns The count of distinct non-empty codes.
 */
function usedColorCount(grid: string[][]): number {
  const seen = new Set<string>()
  for (const row of grid) {
    for (const val of row) {
      if (val !== "") seen.add(val)
    }
  }
  return seen.size
}

/**
 * Each colour actually used in the grid, with its swatch hex and bead count,
 * ordered by the palette's colour-code order.
 *
 * @param grid    - The serialized code grid (`grid[row][col]`, "" = empty).
 * @param palette - Palette used to resolve code → colour.
 * @returns The used colours as `{ code, hex, count }`.
 */
export function usedColorStats(
  grid: string[][],
  palette: Palette,
): { code: string; hex: string; count: number }[] {
  const order = new Map<string, number>()
  const hexByCode = new Map<string, string>()
  palette.colors.forEach((color, i) => {
    order.set(color.code, i)
    hexByCode.set(color.code, color.hex)
  })
  const counts = new Map<string, number>()
  for (const row of grid) {
    for (const code of row) {
      if (code === "") continue
      counts.set(code, (counts.get(code) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity))
    .map(([code, count]) => ({ code, hex: hexByCode.get(code) ?? "#000000", count }))
}

/**
 * Size of the bead-usage list. Width is at least the pattern's width, grown to
 * fit the widest row (estimated with a fixed character advance so the size
 * preview and the render agree without a canvas).
 *
 * @param count     - Number of used colours (one row each).
 * @param baseWidth - The pattern's canvas width.
 * @returns The `{ width, height }` the list occupies below the pattern.
 */
function beadStatsSize(count: number, baseWidth: number): { width: number; height: number } {
  const titleH = BEAD_STATS_TITLE_FONT + 4
  // Monospace advance ≈ 0.6em; code ≤ 4 chars, count ≤ 5 digits.
  const rowTextW = Math.ceil(BEAD_STATS_FONT * 0.6 * 9)
  const rowW = BEAD_STATS_PAD + BEAD_STATS_SWATCH + BEAD_STATS_GAP + rowTextW + BEAD_STATS_PAD
  return {
    width: Math.max(baseWidth, rowW),
    height: BEAD_STATS_PAD + titleH + count * BEAD_STATS_ROW_H + BEAD_STATS_PAD,
  }
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
 * @param grid    - The serialized code grid (`grid[row][col]`, "" = empty).
 * @param palette - Palette used to resolve code → colour hex.
 * @param scale   - Pixels per bead (integer; clamped to fit the canvas limit).
 * @param opts    - Optional export options.
 */
export function exportGridPng(
  grid: string[][],
  palette: Palette,
  scale = DEFAULT_EXPORT_SCALE,
  opts: ExportGridOptions = {},
): void {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  if (rows === 0 || cols === 0) return

  const layout = computeLayout(cols, rows, scale)
  const { s, numFont, headerW, headerH } = layout

  const hexByCode = new Map<string, string>()
  for (const color of palette.colors) hexByCode.set(color.code, color.hex)

  const used = opts.showBeadStats ? usedColorStats(grid, palette) : []
  const detail = opts.showBeadStats ? beadStatsSize(used.length, layout.width) : null

  const canvas = document.createElement("canvas")
  canvas.width = detail ? detail.width : layout.width
  canvas.height = layout.height + (detail ? detail.height : 0)
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
      const code = row[c]
      if (code === "") continue
      const hex = hexByCode.get(code)
      if (!hex) continue
      ctx.fillStyle = hex
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
        const code = row[c]
        if (code === "") continue
        const label = code
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

  // Bead-usage list below the pattern: a title line, then one row per used
  // colour (swatch, code, count). Text style is reset from the centred labels.
  if (detail) {
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    let y = layout.height + BEAD_STATS_PAD
    ctx.fillStyle = LABEL_COLOR
    ctx.font = `600 ${BEAD_STATS_TITLE_FONT}px ui-monospace, monospace`
    ctx.fillText(opts.beadStatsTitle ?? "Beads used", headerW + BEAD_STATS_PAD, y + BEAD_STATS_TITLE_FONT / 2)
    y += BEAD_STATS_TITLE_FONT + 4

    ctx.font = `${BEAD_STATS_FONT}px ui-monospace, monospace`
    const textX = headerW + BEAD_STATS_PAD + BEAD_STATS_SWATCH + BEAD_STATS_GAP
    for (const { hex, code, count } of used) {
      ctx.fillStyle = hex
      ctx.fillRect(headerW + BEAD_STATS_PAD, y, BEAD_STATS_SWATCH, BEAD_STATS_SWATCH)
      ctx.fillStyle = "#111"
      ctx.fillText(`${code}  ×${count}`, textX, y + BEAD_STATS_SWATCH / 2)
      y += BEAD_STATS_ROW_H
    }
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
