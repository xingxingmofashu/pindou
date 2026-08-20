import { zipSync } from "fflate"
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

/** Square tile counts offered by the export split option (N = N×N sheets). */
export const EXPORT_TILE_COUNTS = [1, 4, 9, 16] as const

/** Square root of a tile count — the number of columns/rows of sheets. */
const TILE_DIM = (count: number): number => Math.round(Math.sqrt(count))

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

/** Layout of the bead-usage section: its columns and the space it occupies. */
interface StatsLayout {
  cols: number
  width: number
  height: number
}

/** A colour used in the grid, with its swatch hex and count, in palette order. */
interface UsedColor {
  code: string
  hex: string
  count: number
}

/** Bead-usage stats for one export image (a full grid or one sheet). */
interface WindowStats {
  used: UsedColor[]
  detail: StatsLayout | null
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
  /**
   * Split the pattern into `count` square sheets (1, 4, 9 or 16; 1 = one full
   * image). Each sheet is a self-contained chart — it keeps the full coordinate
   * bands, so the sheets tile together exactly — and downloads as a single
   * ZIP archive of PNGs.
   * (`pattern-…-tile-{i}-of-{n}.png`). The bead-usage list, when enabled, is
   * only drawn on sheets that contain at least one painted cell.
   */
  tileCount?: 1 | 4 | 9 | 16
}

/** One sheet of a split export. */
export interface ExportTile {
  /** 1-based sheet index in reading order (row-major). */
  index: number
  /** Total number of sheets (the requested tile count). */
  count: number
  /** Column of this sheet in the sheet grid (0-based). */
  col: number
  /** Row of this sheet in the sheet grid (0-based). */
  row: number
  /** Columns of the sheet grid (√count). */
  gridCols: number
  /** Rows of the sheet grid (√count). */
  gridRows: number
  /** First data column of this sheet (0-based, inclusive). */
  dataCol: number
  /** First data row of this sheet (0-based, inclusive). */
  dataRow: number
  /** Number of data columns in this sheet. */
  dataCols: number
  /** Number of data rows in this sheet. */
  dataRows: number
  /** Pixels-per-bead actually used (may be clamped). */
  scale: number
  /** Sheet canvas width in pixels. */
  width: number
  /** Sheet canvas height in pixels (includes the sheet's bead-usage list when it has one). */
  height: number
  /** True when this sheet carries a bead-usage list (it has painted cells and stats are enabled). */
  hasStats: boolean
}

/** Rendered output size plus the effective (clamped) pixels-per-bead. */
export interface ExportSize {
  width: number
  height: number
  scale: number
  /**
   * Per-sheet dimensions when {@link ExportGridOptions.tileCount} splits the
   * export into multiple images; `null` for a single full-size image. Each
   * entry covers one sheet's data extent — the UI uses this to preview the
   * sheet size and how many beads each sheet spans.
   */
  tiles?: Omit<ExportTile, "hasStats">[] | null
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

  /** The distinct number of painted colours inside a data-cell window. */
  private static usedColorCountInWindow(
    grid: string[][],
    win: { colStart: number; colEnd: number; rowStart: number; rowEnd: number },
  ): number {
    const seen = new Set<string>()
    forEachPaintedCell(grid, (code, r, c) => {
      if (c < win.colStart || c >= win.colEnd || r < win.rowStart || r >= win.rowEnd) return
      seen.add(code)
    })
    return seen.size
  }

  /** Each colour used in a grid region with its swatch hex and count, in palette order. */
  private static usedColors(
    grid: string[][],
    palette: Palette,
    win?: { colStart: number; colEnd: number; rowStart: number; rowEnd: number },
  ): UsedColor[] {
    const order = new Map(palette.colors.map((color, i) => [color.code, i]))
    const hexByCode = buildHexByCode(palette)
    const counts = new Map<string, number>()
    forEachPaintedCell(grid, (code, r, c) => {
      if (win && (c < win.colStart || c >= win.colEnd || r < win.rowStart || r >= win.rowEnd)) return
      counts.set(code, (counts.get(code) ?? 0) + 1)
    })
    return Array.from(counts)
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
  ): StatsLayout {
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
  private static computeLayout(cols: number, rows: number, scale: number, statsCount = 0): Layout {    const upper = Math.max(1, Math.min(scale, Math.floor(MAX_EXPORT_DIM / Math.max(cols, rows))))

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
   * Split a grid into `count` sheets (1, 4, 9 or 16) along bead boundaries, so
   * each sheet covers whole cells and the sheets tile together exactly.
   *
   * @param cols  - Grid columns.
   * @param rows  - Grid rows.
   * @param count - Sheet count (a perfect square); 1 yields a single sheet
   *                covering the whole grid.
   * @returns Row-major sheet descriptors; empty for an empty grid.
   */
  private static tileGrid(
    cols: number,
    rows: number,
    count: number,
  ): Omit<ExportTile, "scale" | "width" | "height" | "hasStats">[] {
    const dim = Math.max(1, TILE_DIM(count))
    const per = { cols: Math.ceil(cols / dim), rows: Math.ceil(rows / dim) }
    const tiles: Omit<ExportTile, "scale" | "width" | "height" | "hasStats">[] = []
    let index = 1
    for (let tr = 0; tr < dim; tr++) {
      for (let tc = 0; tc < dim; tc++) {
        const dataCol = tc * per.cols
        const dataRow = tr * per.rows
        tiles.push({
          index,
          count,
          col: tc,
          row: tr,
          gridCols: dim,
          gridRows: dim,
          dataCol,
          dataRow,
          dataCols: Math.min(cols - dataCol, per.cols),
          dataRows: Math.min(rows - dataRow, per.rows),
        })
        index++
      }
    }
    return tiles
  }

  /**
   * The largest pixels-per-bead whose sheet canvases (bands + data cells + each
   * sheet's own bead-usage list) all stay within {@link MAX_EXPORT_DIM},
   * binary-searched like {@link computeLayout} because every sheet dimension
   * grows monotonically with `s`.
   */
  private static tileScale(
    cols: number,
    rows: number,
    scale: number,
    statsCounts: number[],
    tileCount: number,
  ): number {
    let lo = 1
    let hi = Math.max(1, scale)
    const fits = (s: number): boolean => {
      const tiles = Export.tileGrid(cols, rows, tileCount)
      for (let i = 0; i < tiles.length; i++) {
        const withStats = statsCounts[i] > 0
        const { width, height } = Export.tileLayout(cols, rows, tiles[i], s, statsCounts[i], withStats)
        if (width > MAX_EXPORT_DIM || height > MAX_EXPORT_DIM) return false
      }
      return true
    }
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (fits(mid)) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  /** Width/height of a single sheet at pixels-per-bead `s`. */
  private static tileLayout(
    cols: number,
    rows: number,
    tile: Omit<ExportTile, "scale" | "width" | "height" | "hasStats">,
    s: number,
    statsCount: number,
    withStats: boolean,
  ): { width: number; height: number } {
    const numFont = Math.max(4, Math.round(s * 0.6))
    const headerW = Math.ceil(String(rows).length * numFont * 0.7) + s
    const headerH = s
    let width = headerW + tile.dataCols * s + headerW
    let height = headerH + tile.dataRows * s + headerH
    if (withStats && statsCount > 0) {
      const g = Export.statsGeometry(s)
      const stats = Export.statsSize(g, statsCount, width, headerW)
      width = Math.max(width, stats.width)
      height += stats.height
    }
    return { width, height }
  }

  /**
   * Full exported image size for a grid and scale, plus the effective scale.
   * When {@link ExportGridOptions.tileCount} splits the export, returns the
   * full-image size for reference plus per-sheet sizes in `tiles`.
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
    const tileCount = opts.tileCount ?? 1
    if (tileCount <= 1) return { width, height, scale: s, tiles: null }
    const tileList = Export.tileGrid(size.cols, size.rows, tileCount)
    // Each sheet's usage list counts only the colours inside its own window, so
    // sheets that cover empty regions may carry no list at all.
    const statsCounts = tileList.map((t) =>
      Boolean(opts.showBeadStats)
        ? Export.usedColorCountInWindow(grid, {
            colStart: t.dataCol,
            colEnd: t.dataCol + t.dataCols,
            rowStart: t.dataRow,
            rowEnd: t.dataRow + t.dataRows,
          })
        : 0,
    )
    const ts = Export.tileScale(size.cols, size.rows, scale, statsCounts, tileCount)
    const tiles = tileList.map((t, i) => {
      const withStats = statsCounts[i] > 0
      const { width: tw, height: th } = Export.tileLayout(size.cols, size.rows, t, ts, statsCounts[i], withStats)
      return { ...t, scale: ts, width: tw, height: th }
    })
    return { width, height, scale: ts, tiles }
  }

  /**
   * Render a serialized bead grid to a PNG chart and trigger a download.
   *
   * With {@link ExportGridOptions.tileCount} > 1 the pattern is split into
   * that many square sheets; each sheet is its own self-contained chart (it
   * keeps the full coordinate bands, so the sheets tile together exactly) and
   * downloads inside a single ZIP archive. Each sheet carries its own
   * bead-usage list (when enabled), counting only the colours inside that
   * sheet's window.
   * (when enabled), counting only the colours inside that sheet's window.
   *
   * @param grid    - The serialized code grid (`grid[row][col]`, "" = empty).
   * @param palette - Palette used to resolve code → colour hex.
   * @param scale   - Pixels per bead (integer; clamped to fit the canvas limit).
   * @param opts    - Optional export options.
   * @returns `true` when every PNG was generated and every download was
   *          triggered; `false` when the browser failed to encode a canvas
   *          (e.g. it is too large for the platform).
   */
  async png(
    grid: string[][],
    palette: Palette,
    scale = DEFAULT_EXPORT_SCALE,
    opts: ExportGridOptions = {},
  ): Promise<boolean> {
    const size = gridSize(grid)
    if (!size) return false
    const tileCount = opts.tileCount ?? 1
    if (tileCount > 1) return this.renderTiles(grid, palette, scale, opts, tileCount)

    const layout = this.fullLayout(grid, scale)
    if (!layout) return false
    // Single-image export: the usage list covers the whole grid, so the canvas
    // must fit the grid area plus the usage section below it.
    const stats = Export.statsForWindow(
      grid,
      palette,
      layout.s,
      { colStart: 0, colEnd: layout.cols, rowStart: 0, rowEnd: layout.rows },
      Boolean(opts.showBeadStats),
      layout.width,
      layout.headerW,
    )
    const canvas = document.createElement("canvas")
    canvas.width = stats ? Math.max(layout.width, stats.detail!.width) : layout.width
    canvas.height = layout.height + (stats?.detail?.height ?? 0)
    const ctx = canvas.getContext("2d")
    if (!ctx) return false
    this.renderWindow(ctx, grid, palette, scale, opts, layout, {
      colStart: 0,
      colEnd: layout.cols,
      rowStart: 0,
      rowEnd: layout.rows,
      showStats: true,
    }, stats)
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png")
    })
    if (!blob) return false
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `pattern-${layout.cols}x${layout.rows}@${layout.s}x.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  }

  /**
   * Resolved full-image layout for a grid: the full-canvas geometry plus the
   * grid dimensions, so renderers never recompute the shared geometry.
   * Returns null for an empty grid.
   */
  private fullLayout(
    grid: string[][],
    scale: number,
  ): (Layout & { rows: number; cols: number }) | null {
    const size = gridSize(grid)
    if (!size) return null
    const { rows, cols } = size
    const layout = Export.computeLayout(cols, rows, scale, 0)
    return { ...layout, rows, cols }
  }

  /**
   * Bead-usage stats for a data-cell window: every colour used in it with its
   * count (in palette order), plus the laid-out usage section. Passed to
   * {@link renderWindow} so a sheet's usage list reflects only that sheet's
   * cells. `null` when the usage list is disabled.
   */
  private static statsForWindow(
    grid: string[][],
    palette: Palette,
    s: number,
    win: { colStart: number; colEnd: number; rowStart: number; rowEnd: number },
    showStats: boolean,
    canvasWidth: number,
    headerW: number,
  ): WindowStats | null {
    if (!showStats) return null
    const used = Export.usedColors(grid, palette, win)
    const geo = Export.statsGeometry(s)
    const detail = Export.statsSize(geo, used.length, canvasWidth, headerW)
    return { used, detail }
  }

  /** Data-cell window (half-open ranges) that one export image covers. */
  private static windowForTile(tile: ExportTile): {
    colStart: number
    colEnd: number
    rowStart: number
    rowEnd: number
    showStats: boolean
  } {
    return {
      colStart: tile.dataCol,
      colEnd: tile.dataCol + tile.dataCols,
      rowStart: tile.dataRow,
      rowEnd: tile.dataRow + tile.dataRows,
      showStats: tile.hasStats,
    }
  }

  /**
   * Draw a chart for a data-cell window. Every coordinate is derived from the
   * window, so a sheet renders exactly its own slice: beads outside the window
   * are skipped, grid lines only span the window's boundary, and coordinate
   * labels only cover the window's rows/columns. The window's coordinate bands
   * (top/left) and the outer bands (bottom/right) are always drawn, so each
   * sheet is a complete, self-describing chart that tiles back together with
   * the others.
   *
   * @param ctx    - Destination context (sized to the output canvas).
   * @param grid   - The serialized code grid.
   * @param palette- Palette used to resolve code → colour hex.
   * @param scale  - Pixels per bead (integer; clamped to fit the canvas limit).
   * @param opts   - Optional export options.
   * @param layout - Resolved full layout (see {@link fullLayout}).
   * @param win    - Data-cell window; for a single-image export this is the
   *                 whole grid, for a split export one sheet's slice.
   */
  private renderWindow(
    ctx: CanvasRenderingContext2D,
    grid: string[][],
    palette: Palette,
    scale: number,
    opts: ExportGridOptions,
    layout: Layout & { rows: number; cols: number },
    win: { colStart: number; colEnd: number; rowStart: number; rowEnd: number; showStats: boolean },
    stats: WindowStats | null,
  ): void {
    const { rows, cols, s, numFont, headerW, headerH } = layout
    const { used, detail } = stats ?? { used: [], detail: null }
    // The actual canvas dimensions — for a single-image export these equal the
    // full layout, for a sheet they are the sheet's own size.
    const canvasW = ctx.canvas.width
    const canvasH = ctx.canvas.height
    const geo = Export.statsGeometry(s)
    const showStats = win.showStats && stats !== null && detail !== null
    const colsInWindow = win.colEnd - win.colStart
    const rowsInWindow = win.rowEnd - win.rowStart

    // Grid-area bounds for this window: the bead block plus its bands. The
    // bead-usage section below can grow the canvas beyond the grid on either
    // axis, so band shading, grid lines, dividers, and coordinates anchor to
    // the grid area — never the canvas edges.
    const beadRight = headerW + colsInWindow * s
    const beadBottom = headerH + rowsInWindow * s
    const gridW = beadRight + headerW
    const gridH = beadBottom + headerH

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvasW, canvasH)

    // Shade the top, left, bottom, and right coordinate bands so they read as
    // part of the grid (the corners where the bands meet are covered twice,
    // harmlessly).
    ctx.fillStyle = HEADER_BG
    ctx.fillRect(0, 0, canvasW, headerH)
    ctx.fillRect(0, 0, headerW, canvasH)
    ctx.fillRect(0, beadBottom, canvasW, headerH)
    ctx.fillRect(beadRight, 0, headerW, canvasH)

    const hexByCode = buildHexByCode(palette)
    forEachPaintedCell(grid, (code, r, c) => {
      if (c < win.colStart || c >= win.colEnd || r < win.rowStart || r >= win.rowEnd) return
      const hex = hexByCode.get(code)
      if (!hex) return
      ctx.fillStyle = hex
      ctx.fillRect(headerW + (c - win.colStart) * s, headerH + (r - win.rowStart) * s, s, s)
    })

    // Grid lines run through the coordinate bands and over the beads (matches
    // the editor's grid-over-beads layer order) so header cells and data cells
    // align and every boundary stays visible. Only the window's boundary lines
    // are drawn — one extra line past each edge closes the sheet.
    ctx.strokeStyle = GRID_LINE_COLOR
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let c = 0; c <= colsInWindow; c++) {
      const x = headerW + c * s + 0.5
      ctx.moveTo(x, 0)
      ctx.lineTo(x, gridH)
    }
    for (let r = 0; r <= rowsInWindow; r++) {
      const y = headerH + r * s + 0.5
      ctx.moveTo(0, y)
      ctx.lineTo(gridW, y)
    }
    ctx.stroke()

    // Major grid lines every `step` cells — thicker and darker, grouping the
    // beads into blocks (8×8 by default). Drawn in their own stroke pass
    // because they use a different style; the boundary lines at step multiples
    // overlay the per-bead lines, so blocks stay fully closed. Only lines whose
    // absolute cell index is a step multiple are drawn, so the blocks align
    // across sheets.
    if (opts.showMajorGrid) {
      const requested = Math.floor(opts.majorGridStep ?? MAJOR_GRID_STEP)
      const step = Number.isFinite(requested) && requested > 0 ? requested : MAJOR_GRID_STEP
      ctx.strokeStyle = MAJOR_GRID_COLOR
      ctx.lineWidth = MAJOR_GRID_LINE_WIDTH
      ctx.beginPath()
      const firstCol = Math.floor(win.colStart / step) * step
      const lastCol = Math.ceil(win.colEnd / step) * step
      for (let c = firstCol; c <= lastCol; c += step) {
        const x = headerW + (c - win.colStart) * s + 0.5
        if (x < -0.5 || x > gridW + 0.5) continue
        ctx.moveTo(x, 0)
        ctx.lineTo(x, gridH)
      }
      const firstRow = Math.floor(win.rowStart / step) * step
      const lastRow = Math.ceil(win.rowEnd / step) * step
      for (let r = firstRow; r <= lastRow; r += step) {
        const y = headerH + (r - win.rowStart) * s + 0.5
        if (y < -0.5 || y > gridH + 0.5) continue
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
    // text limit), keeping the output pixel-identical to a direct draw. In a
    // split export each sheet is already small, but the tiling path also covers
    // huge single images.
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
          if (c < win.colStart || c >= win.colEnd || r < win.rowStart || r >= win.rowEnd) return
          const x = headerW + (c - win.colStart + 0.5) * s
          const y = headerH + (r - win.rowStart + 0.5) * s
          const width = labelWidths.get(code)
          if (width === undefined || width > s) return
          if (!overlaps({ x, y, w: width, h: labelFont, centered: true }, padded)) return
          tctx.fillText(code, x, y)
        })
      }

      // Column numbers centred in their header cells along the top and bottom,
      // row numbers centred in theirs down the left and up the right. Every
      // column in the window gets a label; the font is sized to the *full* grid
      // width so numbers match the full pattern (the rightmost sheet can still
      // show three-digit numbers when the full pattern is 1000+ beads wide).
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
      for (let c = win.colStart; c < win.colEnd; c++) {
        const x = headerW + (c - win.colStart + 0.5) * s
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
      for (let r = win.rowStart; r < win.rowEnd; r++) {
        const y = headerH + (r - win.rowStart + 0.5) * s
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
      // labels. Every sheet of a split export carries its own usage list
      // (counting only the cells in its window) when stats are enabled.
      if (showStats && detail) {
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
    if (showStats && detail) {
      const titleY = headerH + rowsInWindow * s + headerH + geo.pad
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

    if (canvasW <= TEXT_SAFE_DIM && canvasH <= TEXT_SAFE_DIM) {
      // Small canvas: draw the text directly, matching the pre-tiling path.
      drawText(ctx, { left: -textPad, top: -textPad, right: canvasW + textPad, bottom: canvasH + textPad })
    } else {
      Export.renderTiledText(ctx, canvasW, canvasH, tileSize, textPad, drawText)
    }
  }

  /**
   * Split a grid into `tileCount` sheets and download them all as a single
   * ZIP archive. Sheets are rendered sequentially so the page stays
   * responsive; each sheet carries its own bead-usage list (when enabled),
   * counting only the cells inside that sheet's window.
   */
  private async renderTiles(
    grid: string[][],
    palette: Palette,
    scale: number,
    opts: ExportGridOptions,
    tileCount: number,
  ): Promise<boolean> {
    const size = gridSize(grid)
    if (!size) return false
    const { rows, cols } = size
    const full = this.fullLayout(grid, scale)
    if (!full) return false
    const tiles = Export.tileGrid(cols, rows, tileCount)
    const statsCounts = tiles.map((t) =>
      Boolean(opts.showBeadStats)
        ? Export.usedColorCountInWindow(grid, {
            colStart: t.dataCol,
            colEnd: t.dataCol + t.dataCols,
            rowStart: t.dataRow,
            rowEnd: t.dataRow + t.dataRows,
          })
        : 0,
    )
    const ts = Export.tileScale(cols, rows, scale, statsCounts, tileCount)
    const last = tiles.length

    const blobs: { name: string; data: Uint8Array }[] = []
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i]
      const hasStats = Boolean(opts.showBeadStats) && statsCounts[i] > 0
      const { width: tw, height: th } = Export.tileLayout(cols, rows, tile, ts, statsCounts[i], hasStats)
      const canvas = document.createElement("canvas")
      canvas.width = tw
      canvas.height = th
      const ctx = canvas.getContext("2d")
      if (!ctx) return false
      const win = Export.windowForTile({ ...tile, scale: ts, width: tw, height: th, hasStats })
      const stats = Export.statsForWindow(
        grid,
        palette,
        ts,
        { colStart: win.colStart, colEnd: win.colEnd, rowStart: win.rowStart, rowEnd: win.rowEnd },
        hasStats,
        tw,
        full.headerW,
      )
      this.renderWindow(ctx, grid, palette, scale, opts, full, win, stats)
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png")
      })
      if (!blob) return false
      blobs.push({
        name: `pattern-${cols}x${rows}-tile-${tile.index}-of-${last}@${ts}x.png`,
        data: new Uint8Array(await blob.arrayBuffer()),
      })
      // Yield to the event loop between sheets so the page stays responsive
      // while 16 images encode.
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    // PNGs are already deflate-compressed, so zipping is a cheap container
    // pass — sync compression is fine here and avoids worker overhead.
    const zipped = zipSync(Object.fromEntries(blobs.map((b) => [b.name, b.data])))
    const zipBlob = new Blob([zipped], { type: "application/zip" })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement("a")
    a.href = url
    a.download = `pattern-${cols}x${rows}-tiles-${last}.zip`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  }
}
