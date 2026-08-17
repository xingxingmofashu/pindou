import { buildHexByCode, countGridBeads, forEachPaintedCell, gridSize } from "@/lib/editor"
import { MAJOR_GRID_STEP } from "@/lib/constants"
import type { Palette } from "@/types"

/** Default pixels per bead when the caller doesn't specify a scale. */
export const DEFAULT_EXPORT_SCALE = 32

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

/**
 * Side length of the per-tile canvases used to render export text. Safari
 * silently drops `fillText`/`strokeText` on canvases larger than ~4096px per
 * side (while fills/strokes still render), so text is rasterized into small
 * tiles and composited back via `drawImage`. 2048 keeps every tile well under
 * that limit at any realistic export size.
 */
const TEXT_TILE_SIZE = 2048

/**
 * Extra pixels of overlap on each side of a text tile, so a glyph that
 * straddles a tile seam is rasterized whole in both neighbours and the
 * composite reconstructs it without clipping. Generous enough to cover the
 * largest label/coordinate font the layout can produce.
 */
const TEXT_TILE_PAD = 128

/**
 * Largest canvas dimension still drawn directly; larger exports tile their text
 * on per-tile canvases that stay under this limit too.
 */
const TEXT_SAFE_DIM = 4096

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
 * 1‑based row/column coordinates in shaded header bands along all four edges
 * (row numbers left and right, column numbers top and bottom). Header cells
 * match a bead's size, so coordinates align with the beads they label. Beads
 * are drawn as solid `scale × scale` squares with no canvas scaling, keeping
 * them pixel-perfect. With {@link ExportGridOptions.showMajorGrid}
 * a thicker, darker grid is drawn every `majorGridStep` cells, grouping the
 * beads into blocks (8×8 by default). With {@link ExportGridOptions.showLabels}
 * each bead gets its colour code centred on it. The effective scale is clamped
 * so the full canvas never exceeds {@link MAX_EXPORT_DIM} on either side. Text
 * (labels, coordinates, bead-usage entries) is drawn on small per-tile canvases
 * and composited back, since Safari drops canvas text on canvases wider or
 * taller than ~4096px while fills/strokes still render.
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
   * Render canvas text through small per-tile canvases instead of the (possibly
   * very large) destination. Safari silently drops `fillText`/`strokeText` on
   * canvases wider or taller than roughly {@link TEXT_SAFE_DIM} pixels while
   * fills and strokes still render, so a large export would lose every label
   * unless the text is drawn on smaller canvases and composited via
   * `drawImage` (a plain pixel copy, unaffected by the text limit). Each tile
   * is `tileSize` square plus a `pad`-pixel border on every side; glyphs that
   * straddle a seam are rasterized whole in both neighbouring tiles and each
   * composite clips back to the tile's own unpadded region, so the seams read
   * correctly.
   *
   * @param target   - The full-size destination context (the export canvas).
   * @param width    - Full canvas width in pixels.
   * @param height   - Full canvas height in pixels.
   * @param tileSize - Unpadded side length of each square tile.
   * @param pad      - Overlap (in pixels) around each tile so seam-straddling
   *                   glyphs are captured by both neighbours.
   * @param draw     - Draws one tile's worth of text; receives the tile context
   *                   already translated to full-canvas coordinates and the tile's
   *                   padded clip rectangle (in full-canvas space) to cull against.
   */
  private static renderTiledText(
    target: CanvasRenderingContext2D,
    width: number,
    height: number,
    tileSize: number,
    pad: number,
    draw: (
      tile: CanvasRenderingContext2D,
      padded: { left: number; top: number; right: number; bottom: number },
    ) => void,
  ): void {
    for (let tileY = 0; tileY < height; tileY += tileSize) {
      const tileH = Math.min(tileSize, height - tileY)
      for (let tileX = 0; tileX < width; tileX += tileSize) {
        const tileW = Math.min(tileSize, width - tileX)
        const canvas = document.createElement("canvas")
        canvas.width = tileW + 2 * pad
        canvas.height = tileH + 2 * pad
        const tile = canvas.getContext("2d")
        if (!tile) continue
        // Translate so the caller draws in full-canvas coordinates; the text
        // sits at an offset of `pad` inside the tile.
        tile.translate(pad - tileX, pad - tileY)
        draw(tile, {
          left: tileX - pad,
          top: tileY - pad,
          right: tileX + tileW + pad,
          bottom: tileY + tileH + pad,
        })
        // Composite only the tile's unpadded interior — the padded border was
        // there to render seam-straddling glyphs, not to be drawn over the
        // neighbours.
        target.drawImage(canvas, pad, pad, tileW, tileH, tileX, tileY, tileW, tileH)
      }
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
      let width = headerW + cols * s + headerW
      let height = headerH + rows * s + headerH
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
   * @returns `true` when the PNG was generated and the download was triggered;
   *          `false` when the browser failed to encode the canvas (e.g. it is
   *          too large for the platform).
   */
  async png(
    grid: string[][],
    palette: Palette,
    scale = DEFAULT_EXPORT_SCALE,
    opts: ExportGridOptions = {},
  ): Promise<boolean> {
    const size = gridSize(grid)
    if (!size) return false
    const { rows, cols } = size

    const hexByCode = buildHexByCode(palette)
    const used = opts.showBeadStats ? Export.usedColors(grid, palette) : []
    const layout = Export.computeLayout(cols, rows, scale, used.length)
    const { s, numFont, headerW, headerH, width, height } = layout
    const geo = Export.statsGeometry(s)
    const detail = opts.showBeadStats ? Export.statsSize(geo, used.length, width, headerW) : null

    // Grid-area bounds: the bead block plus its four coordinate bands. The
    // bead-usage section below can grow the canvas beyond the grid on either
    // axis, so band shading, grid lines, dividers, and coordinates anchor to
    // the grid area — never the canvas edges.
    const beadRight = headerW + cols * s
    const beadBottom = headerH + rows * s
    const gridW = beadRight + headerW
    const gridH = beadBottom + headerH

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return false

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Shade the top, left, bottom, and right coordinate bands so they read as
    // part of the grid (the corners where the bands meet are covered twice,
    // harmlessly).
    ctx.fillStyle = HEADER_BG
    ctx.fillRect(0, 0, canvas.width, headerH)
    ctx.fillRect(0, 0, headerW, canvas.height)
    ctx.fillRect(0, beadBottom, canvas.width, headerH)
    ctx.fillRect(beadRight, 0, headerW, canvas.height)

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
      ctx.lineTo(x, gridH)
    }
    for (let r = 0; r <= rows; r++) {
      const y = headerH + r * s + 0.5
      ctx.moveTo(0, y)
      ctx.lineTo(gridW, y)
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
        ctx.lineTo(x, gridH)
      }
      for (let r = 0; r <= rows; r += step) {
        const y = headerH + r * s + 0.5
        ctx.moveTo(0, y)
        ctx.lineTo(gridW, y)
      }
      ctx.stroke()
    }

    // A slightly darker divider separates the coordinate bands from the beads,
    // running the full extent of each band so the bead area is boxed in.
    ctx.strokeStyle = HEADER_DIVIDER
    ctx.beginPath()
    ctx.moveTo(headerW + 0.5, 0)
    ctx.lineTo(headerW + 0.5, gridH)
    ctx.moveTo(beadRight + 0.5, 0)
    ctx.lineTo(beadRight + 0.5, gridH)
    ctx.moveTo(0, headerH + 0.5)
    ctx.lineTo(gridW, headerH + 0.5)
    ctx.moveTo(0, beadBottom + 0.5)
    ctx.lineTo(gridW, beadBottom + 0.5)
    ctx.stroke()

    // ----- Text layer -----
    // Safari silently drops canvas text (`fillText`/`strokeText`) on canvases
    // larger than ~4096px per side while fills and strokes still render, so a
    // wide/tall export would lose every label, coordinate number, and the
    // bead-usage list. Text is therefore drawn on small per-tile canvases and
    // composited back with `drawImage` (a plain pixel copy, unaffected by the
    // text limit), keeping the output pixel-identical to a direct draw.
    //
    // Colour-code labels on each bead (mirrors the editor's Labels toggle).
    // Widths depend only on the code (the font is fixed), so measure each once
    // on the main context and share the cache across every tile.
    const labelFont = Math.max(4, Math.round(s * 0.4))
    ctx.font = `${labelFont}px ui-monospace, monospace`
    const labelWidths = new Map<string, number>()
    if (opts.showLabels) {
      forEachPaintedCell(grid, (code) => {
        if (!labelWidths.has(code)) labelWidths.set(code, ctx.measureText(code).width)
      })
    }

    const itemW = detail ? Export.statsItemWidth(geo) : 0

    // Bead-usage entries are left-anchored and can be several times the bead
    // size wide, so the tile pad must cover the widest string for seam-straddling
    // glyphs to be captured whole. Keep each tile canvas (tile + 2×pad) under
    // TEXT_SAFE_DIM so the tiles themselves never hit Safari's text limit.
    const statsTextWidths = new Map<string, number>()
    let widestStatsText = 0
    if (detail) {
      ctx.font = `${geo.font}px ui-monospace, monospace`
      for (const { code, count } of used) {
        const text = `${code}  ×${count}`
        const w = ctx.measureText(text).width
        statsTextWidths.set(text, w)
        if (w > widestStatsText) widestStatsText = w
      }
      // The section title is also left-anchored (bold, larger font); include it
      // so a title straddling a seam is captured whole too.
      ctx.font = `600 ${geo.titleFont}px ui-monospace, monospace`
      const title = opts.beadStatsTitle ?? "Beads used"
      if (ctx.measureText(title).width > widestStatsText) {
        widestStatsText = ctx.measureText(title).width
      }
    }
    // The pad is the max glyph half-extent: labels are bounded to `s` wide by
    // the width guard, column numbers fit 0.72s, row numbers are measured, and
    // stats text is left-anchored (full width from its anchor). Half of each is
    // what can spill past a seam.
    ctx.font = `${numFont}px ui-monospace, monospace`
    const rowNumberW = ctx.measureText(String(rows)).width
    const colNumberW = ctx.measureText(String(cols)).width
    const halfExtent = Math.max(
      s / 2,
      Math.ceil(widestStatsText),
      rowNumberW / 2,
      colNumberW / 2,
    )
    const tilePad = Math.max(TEXT_TILE_PAD, Math.ceil(halfExtent))
    // A pathological pad (absurd export scale) must not starve the tile of
    // interior space; cap so the interior keeps at least 64px.
    const tilePadCap = Math.max(0, Math.floor((TEXT_SAFE_DIM - 64) / 2))
    const textPad = Math.min(tilePad, tilePadCap)
    const tileSize = Math.max(1, Math.min(TEXT_TILE_SIZE, TEXT_SAFE_DIM - 2 * textPad))

    // True when the axis-aligned box at `x`,`y` (centred, or left-anchored with
    // width `w`) overlaps the padded tile rect — the tile then rasterizes the
    // whole glyph so the composite reconstructs it across seams.
    const overlaps = (
      box: { x: number; y: number; w: number; h: number; centered: boolean },
      p: { left: number; top: number; right: number; bottom: number },
    ) => {
      const halfW = box.centered ? box.w / 2 : 0
      const halfH = box.h / 2
      const bx0 = box.x - halfW
      const by0 = box.y - halfH
      const bx1 = box.x - halfW + box.w
      const by1 = box.y - halfH + box.h
      return bx1 >= p.left && bx0 <= p.right && by1 >= p.top && by0 <= p.bottom
    }

    // Draw one tile's worth of text. The tile context is translated to
    // full-canvas coordinates, so positions are absolute; the padded clip
    // rectangle (in full-canvas space) culls items whose glyphs fall outside.
    const drawText = (
      tctx: CanvasRenderingContext2D,
      padded: { left: number; top: number; right: number; bottom: number },
    ) => {
      // Colour-code labels on each bead (mirrors the editor's Labels toggle).
      if (opts.showLabels) {
        tctx.fillStyle = BEAD_LABEL_COLOR
        tctx.font = `${labelFont}px ui-monospace, monospace`
        tctx.textAlign = "center"
        tctx.textBaseline = "middle"
        forEachPaintedCell(grid, (code, r, c) => {
          const x = headerW + (c + 0.5) * s
          const y = headerH + (r + 0.5) * s
          const width = labelWidths.get(code)
          if (width === undefined || width > s) return
          if (!overlaps({ x, y, w: width, h: labelFont, centered: true }, padded)) return
          tctx.fillText(code, x, y)
        })
      }

      // Column numbers centred in their header cells along the top and bottom,
      // row numbers centred in theirs down the left and up the right. Every
      // column gets a label: the font shrinks just enough for the widest
      // number (the last column) to fit ~72% of its `s`-wide header cell — the
      // same share two-digit labels already occupy at numFont (2 × 0.6 × 0.6s
      // = 0.72s) — so wide grids read uniformly instead of cramped, and
      // coordinates never silently stop at 99.
      tctx.fillStyle = LABEL_COLOR
      tctx.textBaseline = "middle"
      tctx.textAlign = "center"
      const colLabelBudget = s * 0.72
      let colFont = numFont
      tctx.font = `${colFont}px ui-monospace, monospace`
      while (colFont > 4 && tctx.measureText(String(cols)).width > colLabelBudget) {
        colFont--
        tctx.font = `${colFont}px ui-monospace, monospace`
      }
      const colNumberW = tctx.measureText(String(cols)).width
      for (let c = 0; c < cols; c++) {
        const x = headerW + (c + 0.5) * s
        const yTop = headerH / 2
        const yBottom = beadBottom + headerH / 2
        if (overlaps({ x, y: yTop, w: colNumberW, h: numFont, centered: true }, padded)) {
          tctx.fillText(String(c + 1), x, yTop)
        }
        if (overlaps({ x, y: yBottom, w: colNumberW, h: numFont, centered: true }, padded)) {
          tctx.fillText(String(c + 1), x, yBottom)
        }
      }
      tctx.font = `${numFont}px ui-monospace, monospace`
      const rowNumberW = tctx.measureText(String(rows)).width
      for (let r = 0; r < rows; r++) {
        const y = headerH + (r + 0.5) * s
        const xLeft = headerW / 2
        const xRight = beadRight + headerW / 2
        if (overlaps({ x: xLeft, y, w: rowNumberW, h: numFont, centered: true }, padded)) {
          tctx.fillText(String(r + 1), xLeft, y)
        }
        if (overlaps({ x: xRight, y, w: rowNumberW, h: numFont, centered: true }, padded)) {
          tctx.fillText(String(r + 1), xRight, y)
        }
      }

      // Bead-usage text below the pattern: a title line, then a multi-column
      // grid of entries (code, count). The swatch rectangles are plain fills
      // and are drawn straight onto the main canvas. Text style resets from the
      // labels.
      if (detail) {
        tctx.textAlign = "left"
        tctx.textBaseline = "middle"
const titleY = gridH + geo.pad
        tctx.fillStyle = LABEL_COLOR
        tctx.font = `600 ${geo.titleFont}px ui-monospace, monospace`
        const titleX = headerW + geo.pad
        const titleCY = titleY + geo.titleFont / 2
        const title = opts.beadStatsTitle ?? "Beads used"
        if (overlaps({ x: titleX, y: titleCY, w: tctx.measureText(title).width, h: geo.titleFont, centered: false }, padded)) {
          tctx.fillText(title, titleX, titleCY)
        }
        const bodyY = titleY + geo.titleFont + 4

        tctx.font = `${geo.font}px ui-monospace, monospace`
        used.forEach(({ code, count }, i) => {
          const col = i % detail.cols
          const row = Math.floor(i / detail.cols)
          const x = headerW + geo.pad + col * itemW
          const y = bodyY + row * geo.rowH + geo.swatch / 2
          const text = `${code}  ×${count}`
          // The swatch precedes the text, so the label's left-anchored box must
          // start at the text x, not the cell x.
          const textX = x + geo.pad + geo.swatch + geo.gap
          if (!overlaps({ x: textX, y, w: statsTextWidths.get(text) ?? 0, h: geo.font, centered: false }, padded)) return
          tctx.fillStyle = "#111"
          tctx.fillText(text, textX, y)
        })
      }
    }

    // Bead-usage swatch rectangles — plain fills, safe on the main canvas.
    if (detail) {
      const titleY = headerH + rows * s + headerH + geo.pad
      const bodyY = titleY + geo.titleFont + 4
      used.forEach(({ hex }, i) => {
        const col = i % detail.cols
        const row = Math.floor(i / detail.cols)
        const x = headerW + geo.pad + col * itemW
        const y = bodyY + row * geo.rowH
        ctx.fillStyle = hex
        ctx.fillRect(x, y, geo.swatch, geo.swatch)
      })
    }

    if (width <= TEXT_SAFE_DIM && height <= TEXT_SAFE_DIM) {
      // Small canvas: draw the text directly, matching the pre-tiling path.
      drawText(ctx, { left: -textPad, top: -textPad, right: width + textPad, bottom: height + textPad })
    } else {
      Export.renderTiledText(ctx, width, height, tileSize, textPad, drawText)
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png")
    })
    if (!blob) return false
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `pattern-${cols}x${rows}@${s}x.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  }
}
