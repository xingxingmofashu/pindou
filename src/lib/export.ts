import { buildHexByCode, countGridBeads, forEachPaintedCell, gridSize } from "@/lib/editor"
import { MAJOR_GRID_STEP } from "@/lib/constants"
import type { Palette } from "@/types"

/** Default pixels per bead when the caller doesn't specify a scale. */
export const DEFAULT_EXPORT_SCALE = 64

/**
 * Largest canvas dimension in pixels. Caps memory on pathological grids
 * (MAX_GRID_DIMENSION allows 4096×4096) and keeps the canvas within the
 * browser's practical limit (16384 per side).
 */
const MAX_EXPORT_DIM = 16384

/** Grid-line colour between beads. */
const GRID_LINE_COLOR = "#a1a1aa"

/** Major grid-line colour — darker than the per-bead grid lines. */
const MAJOR_GRID_COLOR = "#71717a"

/** Major grid-line width in pixels — thicker than the per-bead lines. */
const MAJOR_GRID_LINE_WIDTH = 2

/** Axis-label colour. */
const LABEL_COLOR = "#52525b"

/** Bead colour-code label fill — matches the editor's label style. */
const BEAD_LABEL_COLOR = "#111"

/** Shaded background for the top/left coordinate bands. */
const HEADER_BG = "#f4f4f5"

/** Divider between the coordinate bands and the bead area. */
const HEADER_DIVIDER = "#a1a1aa"

/**
 * Base geometry of the bead-usage section, defined at a 20px swatch. The real
 * geometry is derived from the pattern's bead size, so the list scales up with
 * the grid — at the default 64px-per-bead export the swatches are bead-sized.
 */
const STATS_SWATCH = 20
const STATS_TITLE_FONT = 18
const STATS_FONT = 16
const STATS_ROW_H = 32
const STATS_GAP = 8
const STATS_PAD = 12

/** Scaled bead-usage section geometry, derived from the pattern's bead size. */
interface StatsGeometry {
  titleFont: number
  font: number
  rowH: number
  swatch: number
  gap: number
  pad: number
}

/** Bead-area geometry shared by rendering and size previews. */
interface Layout {
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

/** Export options. */
export interface ExportGridOptions {
  /** Draw each bead's colour code (e.g. "A1") centred in the cell. */
  showLabels?: boolean
  /** Append a bead-usage list (swatch, code, count) below the pattern. */
  showBeadStats?: boolean
  /** Title of the bead-usage list; falls back to "Beads used". */
  beadStatsTitle?: string
  /** Draw thicker, darker grid lines every {@link majorGridStep} cells. */
  showMajorGrid?: boolean
  /** Step (in data cells) of the major grid; defaults to {@link MAJOR_GRID_STEP}. */
  majorGridStep?: number
}

/** Rendered output size plus the effective (clamped) pixels-per-bead. */
export interface ExportSize {
  width: number
  height: number
  scale: number
}

/**
 * Renders bead-grid patterns to printable PNG charts.
 *
 * The output is a pattern chart: a white background, light grid lines, and
 * 1‑based row/column coordinates in shaded header bands along the top and left
 * edges. Header cells match a bead's size, so coordinates align with the beads
 * they label. Beads are drawn as solid `scale × scale` squares with no canvas
 * scaling, keeping them pixel-perfect. With {@link ExportGridOptions.showMajorGrid}
 * a thicker, darker grid is drawn every `majorGridStep` cells, grouping the
 * beads into blocks (8×8 by default). With {@link ExportGridOptions.showLabels}
 * each bead gets its colour code centred on it. The effective scale is clamped
 * so the full canvas never exceeds {@link MAX_EXPORT_DIM} on either side.
 */
export class Export {
  /** The distinct number of painted colours — one bead-usage row per colour. */
  private static usedColorCount(grid: string[][]): number {
    return countGridBeads(grid).size
  }

  /** Each colour used in the grid with its swatch hex and count, in palette order. */
  private static usedColors(
    grid: string[][],
    palette: Palette,
  ): { code: string; hex: string; count: number }[] {
    const order = new Map(palette.colors.map((color, i) => [color.code, i]))
    const hexByCode = buildHexByCode(palette)
    return Array.from(countGridBeads(grid))
      .sort(([a], [b]) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity))
      .map(([code, count]) => ({ code, hex: hexByCode.get(code) ?? "#000000", count }))
  }

  /**
   * Scale the base bead-usage geometry to a bead size `s`. Every dimension is
   * proportional, so the section reads like part of the pattern at any scale.
   */
  private static statsGeometry(s: number): StatsGeometry {
    const k = s / STATS_SWATCH
    return {
      titleFont: Math.max(4, Math.round(STATS_TITLE_FONT * k)),
      font: Math.max(4, Math.round(STATS_FONT * k)),
      rowH: Math.max(8, Math.round(STATS_ROW_H * k)),
      swatch: Math.max(2, Math.round(STATS_SWATCH * k)),
      gap: Math.max(1, Math.round(STATS_GAP * k)),
      pad: Math.max(2, Math.round(STATS_PAD * k)),
    }
  }

  /** Width of one bead-usage entry, estimated with a fixed monospace advance so
   * the size preview and the render agree without a canvas. */
  private static statsItemWidth(g: StatsGeometry): number {
    const textW = Math.ceil(g.font * 0.6 * 13)
    return g.pad + g.swatch + g.gap + textW + g.pad
  }

  /** How many bead-usage entries fit per row in the available width. */
  private static statsColumns(g: StatsGeometry, availableWidth: number): number {
    return Math.max(1, Math.floor((availableWidth - g.pad) / Export.statsItemWidth(g)))
  }

  /** Layout of the bead-usage section: width, height, and column count. */
  private static statsSize(
    g: StatsGeometry,
    count: number,
    canvasWidth: number,
    headerW: number,
  ): { width: number; height: number; cols: number } {
    const titleH = g.titleFont + 4
    const itemW = Export.statsItemWidth(g)
    const cols = Export.statsColumns(g, canvasWidth - headerW)
    const rows = Math.ceil(count / cols)
    return {
      cols,
      width: Math.max(canvasWidth, headerW + g.pad + cols * itemW + g.pad),
      height: g.pad + titleH + rows * g.rowH + g.pad,
    }
  }

  /**
   * Compute the full-canvas layout for a grid and scale. Coordinate numbers are
   * sized to a bead-sized header cell; width/height grow monotonically with `s`,
   * so the largest `s` whose full canvas (bands, padding, and the bead-usage
   * section) fits the limit is binary-searched — clamping only the bead area
   * would overflow the canvas.
   */
  private static computeLayout(cols: number, rows: number, scale: number, statsCount = 0): Layout {
    const upper = Math.max(1, Math.min(scale, Math.floor(MAX_EXPORT_DIM / Math.max(cols, rows))))

    const dims = (s: number) => {
      const numFont = Math.max(4, Math.round(s * 0.6))
      const headerW = Math.ceil(String(rows).length * numFont * 0.7) + s
      const headerH = s
      let width = headerW + cols * s + s
      let height = headerH + rows * s + s
      if (statsCount > 0) {
        const stats = Export.statsSize(Export.statsGeometry(s), statsCount, width, headerW)
        width = Math.max(width, stats.width)
        height += stats.height
      }
      return { numFont, headerW, headerH, width, height }
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
   * @returns The canvas width/height and the effective pixels-per-bead, or null
   *          for an empty grid.
   */
  size(grid: string[][], scale: number, opts: ExportGridOptions = {}): ExportSize | null {
    const size = gridSize(grid)
    if (!size) return null
    const count = opts.showBeadStats ? Export.usedColorCount(grid) : 0
    const { s, width, height } = Export.computeLayout(size.cols, size.rows, scale, count)
    return { width, height, scale: s }
  }

  /**
   * Render a serialized bead grid to a PNG chart and trigger a download.
   *
   * @param grid    - The serialized code grid (`grid[row][col]`, "" = empty).
   * @param palette - Palette used to resolve code → colour hex.
   * @param scale   - Pixels per bead (integer; clamped to fit the canvas limit).
   * @param opts    - Optional export options.
   */
  png(
    grid: string[][],
    palette: Palette,
    scale = DEFAULT_EXPORT_SCALE,
    opts: ExportGridOptions = {},
  ): void {
    const size = gridSize(grid)
    if (!size) return
    const { rows, cols } = size

    const hexByCode = buildHexByCode(palette)
    const used = opts.showBeadStats ? Export.usedColors(grid, palette) : []
    const layout = Export.computeLayout(cols, rows, scale, used.length)
    const { s, numFont, headerW, headerH, width, height } = layout
    const geo = Export.statsGeometry(s)
    const detail = opts.showBeadStats ? Export.statsSize(geo, used.length, width, headerW) : null

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Shade the top and left coordinate bands so they read as part of the grid
    // (the corner where the bands meet is covered twice, harmlessly).
    ctx.fillStyle = HEADER_BG
    ctx.fillRect(0, 0, canvas.width, headerH)
    ctx.fillRect(0, 0, headerW, canvas.height)

    forEachPaintedCell(grid, (code, r, c) => {
      const hex = hexByCode.get(code)
      if (!hex) return
      ctx.fillStyle = hex
      ctx.fillRect(headerW + c * s, headerH + r * s, s, s)
    })

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

    // Major grid lines every `step` cells — thicker and darker, grouping the
    // beads into blocks (8×8 by default). Drawn in their own stroke pass
    // because they use a different style; the boundary lines at step multiples
    // overlay the per-bead lines, so blocks stay fully closed.
    if (opts.showMajorGrid) {
      const requested = Math.floor(opts.majorGridStep ?? MAJOR_GRID_STEP)
      const step = Number.isFinite(requested) && requested > 0 ? requested : MAJOR_GRID_STEP
      ctx.strokeStyle = MAJOR_GRID_COLOR
      ctx.lineWidth = MAJOR_GRID_LINE_WIDTH
      ctx.beginPath()
      for (let c = 0; c <= cols; c += step) {
        const x = headerW + c * s + 0.5
        ctx.moveTo(x, 0)
        ctx.lineTo(x, headerH + rows * s)
      }
      for (let r = 0; r <= rows; r += step) {
        const y = headerH + r * s + 0.5
        ctx.moveTo(0, y)
        ctx.lineTo(headerW + cols * s, y)
      }
      ctx.stroke()
    }

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
      forEachPaintedCell(grid, (code, r, c) => {
        let width = labelWidths.get(code)
        if (width === undefined) {
          width = ctx.measureText(code).width
          labelWidths.set(code, width)
        }
        if (width > s) return
        ctx.fillText(code, headerW + (c + 0.5) * s, headerH + (r + 0.5) * s)
      })
    }

    // Column numbers centred in their header cells along the top, row numbers
    // centred in theirs down the left. Every column gets a label: the font
    // shrinks just enough for the widest number (the last column) to fit ~72%
    // of its `s`-wide header cell — the same share two-digit labels already
    // occupy at numFont (2 × 0.6 × 0.6s = 0.72s) — so wide grids read uniformly
    // instead of cramped, and coordinates never silently stop at 99.
    ctx.fillStyle = LABEL_COLOR
    ctx.textBaseline = "middle"
    ctx.textAlign = "center"
    const colLabelBudget = s * 0.72
    let colFont = numFont
    ctx.font = `${colFont}px ui-monospace, monospace`
    while (colFont > 4 && ctx.measureText(String(cols)).width > colLabelBudget) {
      colFont--
      ctx.font = `${colFont}px ui-monospace, monospace`
    }
    for (let c = 0; c < cols; c++) {
      ctx.fillText(String(c + 1), headerW + (c + 0.5) * s, headerH / 2)
    }
    ctx.font = `${numFont}px ui-monospace, monospace`
    for (let r = 0; r < rows; r++) {
      ctx.fillText(String(r + 1), headerW / 2, headerH + (r + 0.5) * s)
    }

    // Bead-usage section below the pattern: a title line, then a multi-column
    // grid of entries (swatch, code, count). Text style resets from the labels.
    if (detail) {
      ctx.textAlign = "left"
      ctx.textBaseline = "middle"
      const titleY = headerH + rows * s + geo.pad
      ctx.fillStyle = LABEL_COLOR
      ctx.font = `600 ${geo.titleFont}px ui-monospace, monospace`
      ctx.fillText(opts.beadStatsTitle ?? "Beads used", headerW + geo.pad, titleY + geo.titleFont / 2)
      const bodyY = titleY + geo.titleFont + 4

      ctx.font = `${geo.font}px ui-monospace, monospace`
      const itemW = Export.statsItemWidth(geo)
      used.forEach(({ hex, code, count }, i) => {
        const col = i % detail.cols
        const row = Math.floor(i / detail.cols)
        const x = headerW + geo.pad + col * itemW
        const y = bodyY + row * geo.rowH
        ctx.fillStyle = hex
        ctx.fillRect(x, y, geo.swatch, geo.swatch)
        ctx.fillStyle = "#111"
        ctx.fillText(
          `${code}  ×${count}`,
          x + geo.pad + geo.swatch + geo.gap,
          y + geo.swatch / 2,
        )
      })
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
}
