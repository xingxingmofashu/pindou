import type { Application, Container, Graphics } from "pixi.js"
import type { Palette } from "@pindou/shared/types"
import { BeadRenderer } from "./grid/bead-renderer"
import { CodeGrid } from "./grid/code-grid"
import { Grid } from "./grid/grid"
import { Path } from "./grid/path"
import type { BeadEntry, BeadStats, GridBounds, GridRect, ViewRect } from "./grid/types"
import { Viewport } from "./grid/viewport"
import { MostFrequent } from "./most-frequent"
import { ColorSeries } from "./palette/color-series"
import { PaletteIndex } from "./palette/palette-index"

/*
 * Public entry point for the grid model.
 *
 * The real implementations live in the classes re-exported below; every
 * function here is a thin forwarder kept so existing imports from
 * `@pindou/core/editor` keep compiling while call sites migrate (REFACTOR.md
 * S1–S3). The forwarders are deleted in S4.
 */

export { EMPTY, Grid } from "./grid/grid"
export { CodeGrid } from "./grid/code-grid"
export { GridHistory } from "./grid/grid-history"
export { Viewport } from "./grid/viewport"
export { BeadRenderer } from "./grid/bead-renderer"
export { Path } from "./grid/path"
export { MostFrequent } from "./most-frequent"
export { PaletteIndex } from "./palette/palette-index"
export { ColorSeries } from "./palette/color-series"
export type { BeadEntry, BeadStats, GridBounds, GridRect, ViewRect } from "./grid/types"

/** Identifies one of the drawing tools. */
export type ToolKind = "pen" | "eraser" | "fill" | "eyedropper"

/** PixiJS scene-graph objects passed between {@link usePixiApp} and {@link usePixiCanvas}. */
export interface PixiContext {
  app: Application
  world: Container
  beadsGfx: Graphics
  gridGfx: Graphics
}

/** The canvas snapshot contract shared by the editor, export, and publish. */
export interface CellsData {
  grid: string[][]
  brandCode: string
  beadStats: string
}

/**
 * Compute the bounding box of all painted cells in a sparse grid.
 *
 * @param cells - The sparse cell map.
 * @returns The bounding box, or `null` if the map is empty.
 */
export function getGridBounds(cells: Map<string, number>): GridBounds | null {
  return Grid.boundsOf(cells)
}

/**
 * Per-colour bead counts for a sparse grid (no dense grid allocation — unlike
 * {@link serializeGrid} + {@link serializeBeadStats}). Also returns the painted
 * bounding-box size and total bead count for the stats header.
 *
 * @param cells   - The sparse cell map (read only — taken by reference, not copied).
 * @param palette - Palette used to resolve colour index → code.
 * @returns The dims/total and per-code counts, or null when the grid is empty.
 */
export function countBeadStats(
  cells: Map<string, number>,
  palette: Palette,
): BeadStats | null {
  return new Grid(palette, cells).stats()
}

/**
 * The world-unit extent of a painted region's bounding box.
 *
 * @param bounds - The bounding box of painted cells.
 * @returns `{ ww, wh }` — the width/height in world units.
 */
export function boundsWorldSize(bounds: GridBounds): { ww: number; wh: number } {
  return Viewport.boundsSize(bounds)
}

/**
 * Position the world container so painted cells are centred in the viewport.
 *
 * @param world   - The PixiJS world Container (mutated in place).
 * @param bounds  - The bounding box of painted cells.
 * @param screenW - Viewport width in screen pixels.
 * @param screenH - Viewport height in screen pixels.
 * @param zoom    - Current zoom level.
 */
export function centerViewport(
  world: { x: number; y: number },
  bounds: GridBounds,
  screenW: number,
  screenH: number,
  zoom: number,
): void {
  const { x, y } = Viewport.center(bounds, screenW, screenH, zoom)
  world.x = x
  world.y = y
}

/**
 * Write a rectangular block of data cells to the sparse grid.
 *
 * Passing {@link EMPTY} as `colorIdx` removes the cells from the map.
 *
 * @param map      - The sparse cell map to write into.
 * @param c0       - Left column (inclusive).
 * @param r0       - Top row (inclusive).
 * @param c1       - Right column (exclusive).
 * @param r1       - Bottom row (exclusive).
 * @param colorIdx - 1‑based palette index, or {@link EMPTY} to erase.
 */
export function paintBlock(
  map: Map<string, number>,
  c0: number,
  r0: number,
  c1: number,
  r1: number,
  colorIdx: number,
): void {
  Grid.paintBlockIn(map, c0, r0, c1, r1, colorIdx)
}

/**
 * Flood-fill a connected region of the sparse grid.
 *
 * Starting from the cell at `(c, r)`, every 4‑connected neighbour whose
 * current colour equals the start cell's colour is recoloured to `colorIdx`.
 * Empty start regions (colour {@link EMPTY}) are bounded by the painted
 * bounding box padded by one cell, so filling background can't escape to
 * infinity on the unbounded sparse grid; non‑empty regions are already closed
 * off by neighbouring colours. On an entirely empty canvas there is no
 * bounding box to fill against, so the call is a no-op. Passing {@link EMPTY}
 * as `colorIdx` removes the filled cells (erase a connected region).
 *
 * @param map      - The sparse cell map to write into.
 * @param c        - Start column.
 * @param r        - Start row.
 * @param colorIdx - 1‑based palette index, or {@link EMPTY} to erase.
 */
export function floodFill(
  map: Map<string, number>,
  c: number,
  r: number,
  colorIdx: number,
): void {
  Grid.floodFillIn(map, c, r, colorIdx)
}

/**
 * Walk along a line segment between two integer grid points, invoking a
 * callback for every point on the path (Bresenham's algorithm).
 *
 * @param x0 - Start column.
 * @param y0 - Start row.
 * @param x1 - End column.
 * @param y1 - End row.
 * @param fn - Callback invoked for each grid point on the line.
 */
export function walkLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  fn: (x: number, y: number) => void,
): void {
  Path.walk(x0, y0, x1, y1, fn)
}

/**
 * Convert the sparse cell map into a compact 2D code grid suitable for
 * storage: `""` = empty, any other value is a brand colour code (e.g. "A1").
 *
 * @param cells   - The sparse cell map (read only — taken by reference, not copied).
 * @param palette - Palette used to resolve index → colour code.
 * @returns A rectangular `string[][]`, or `null` if the canvas is empty or
 *          the bounding box exceeds `MAX_GRID_DIMENSION` in either axis.
 */
export function serializeGrid(
  cells: Map<string, number>,
  palette: Palette,
): string[][] | null {
  return new Grid(palette, cells).toCodeGrid()?.codes ?? null
}

/**
 * The inverse of {@link serializeGrid} — rebuild a sparse cell map from a
 * compact 2D code grid. Colour codes are resolved to the palette's 1‑based
 * index (codes absent from the palette are skipped).
 *
 * @param grid    - The rectangular `string[][]` ("" = empty) to load.
 * @param palette - Palette used to resolve colour code → index.
 * @returns A new sparse cell map.
 */
export function deserializeGrid(
  grid: string[][],
  palette: Palette,
): Map<string, number> {
  return CodeGrid.from(grid)?.toCells(palette) ?? new Map()
}

/**
 * Resolve a serialized code grid's dimensions, or null when it is empty.
 *
 * @param grid - The rectangular `string[][]` ("" = empty).
 * @returns `{ rows, cols }`, or null when either axis has no cells.
 */
export function gridSize(grid: string[][]): { rows: number; cols: number } | null {
  return CodeGrid.from(grid)?.size ?? null
}

/**
 * Count painted cells per colour code in a serialized code grid.
 *
 * @param grid - The rectangular `string[][]` to count ("" = empty).
 * @returns A map of colour code → bead count.
 */
export function countGridBeads(grid: string[][]): Map<string, number> {
  return CodeGrid.from(grid)?.counts() ?? new Map()
}

/**
 * Count beads per colour code for a serialized code grid, serialized as a JSON
 * string mapping colour code → bead count (e.g. `{"A1":12}`) — the
 * stored/published form of a pattern's usage stats.
 *
 * @param grid - The rectangular `string[][]` to count ("" = empty).
 * @returns The JSON string.
 */
export function serializeBeadStats(grid: string[][]): string {
  return CodeGrid.from(grid)?.beadStatsJson() ?? "{}"
}

/**
 * Build a colour-code → hex lookup for a palette.
 *
 * @param palette - The palette to index.
 * @returns A map of colour code (e.g. "A1") → hex string.
 */
export function buildHexByCode(palette: Palette): Map<string, string> {
  return new PaletteIndex(palette).hexMap()
}

/**
 * Group items by the series letter each item maps to, preserving first-seen
 * order. Callers pass a `seriesOf` mapper (e.g. `(c) => c.series ?? "?"`).
 *
 * @param items    - The items to group.
 * @param seriesOf - Maps an item to its series key.
 * @returns The groups in first-seen order.
 */
export function groupColorsBySeries<T>(
  items: T[],
  seriesOf: (item: T) => string,
): { series: string; colors: T[] }[] {
  return ColorSeries.group(items, seriesOf)
}

/**
 * Visit every painted cell of a code grid, skipping empty cells.
 *
 * The callback keeps the historical `(code, row, col)` argument order; the
 * class API (`CodeGrid.forEachPainted`) uses `(code, col, row)` instead.
 *
 * @param grid - The rectangular `string[][]` ("" = empty).
 * @param fn   - Called with the colour code and the cell's row/column.
 */
export function forEachPaintedCell(
  grid: string[][],
  fn: (code: string, row: number, col: number) => void,
): void {
  CodeGrid.from(grid)?.forEachPainted((code, c, r) => fn(code, r, c))
}

/**
 * Visit every painted cell inside a half-open window of a code grid, skipping
 * empty cells.
 *
 * The callback keeps the historical `(code, row, col)` argument order; the
 * class API (`CodeGrid.forEachPaintedInWindow`) uses `(code, col, row)`.
 *
 * @param grid - The rectangular `string[][]` ("" = empty).
 * @param win  - Half-open window bounds (`colStart ≤ c < colEnd`, same for rows).
 * @param fn   - Called with the colour code and the cell's row/column.
 */
export function forEachPaintedCellInWindow(
  grid: string[][],
  win: { colStart: number; colEnd: number; rowStart: number; rowEnd: number },
  fn: (code: string, row: number, col: number) => void,
): void {
  CodeGrid.from(grid)?.forEachPaintedInWindow(win, (code, c, r) => fn(code, r, c))
}

/**
 * Compute LOD parameters for a given zoom level.
 *
 * The visual cell size is chosen so that each visual cell is at least
 * `MIN_PX` screen pixels wide.
 *
 * @param zoom - Current zoom level.
 * @returns `{ scale, size }` where `scale` is the LOD factor and `size` is
 *          the world-unit size of a visual cell.
 */
export function lodParams(zoom: number): { scale: number; size: number } {
  return new Viewport(zoom).lod()
}

/**
 * Compute the grid-line rectangles for the visible viewport.
 *
 * Renderer-agnostic: returns a list of world-space rectangles. The caller
 * (the PixiJS hook) is responsible for drawing them.
 *
 * @param view     - Visible viewport rectangle in world space.
 * @param cellSize - World-unit size of each visual cell.
 * @param zoom     - Current zoom level (affects line width).
 * @returns The list of grid-line rectangles covering the viewport (plus a
 *          margin), and the computed line width.
 */
export function computeGridLines(
  view: ViewRect,
  cellSize: number,
  zoom: number,
): { rects: GridRect[]; lineWidth: number } {
  return new Viewport(zoom).gridLines(view, cellSize)
}

/**
 * Return the key with the highest count in a frequency map.
 *
 * @param counts - Map from key to occurrence count.
 * @param skip   - Optional predicate for keys to ignore (e.g. {@link EMPTY}).
 * @returns The most frequent key, or `undefined` when the map is empty (or
 *          every entry is skipped).
 */
export function mostFrequent<K>(
  counts: Map<K, number>,
  skip?: (key: K) => boolean,
): K | undefined {
  return MostFrequent.of(counts, skip)
}

/**
 * Build a list of {@link BeadEntry} descriptors from the sparse cell map.
 *
 * Iterates all painted cells, buckets them by visual cell at the current LOD
 * scale, picks the dominant colour per bucket, and returns only the non-empty
 * entries that fall within the visible viewport.
 *
 * @param map      - The sparse cell map (read only — taken by reference, not copied).
 * @param view     - Visible viewport rectangle in world space.
 * @param lodScale - LOD factor (1 = 1:1, higher values merge cells).
 * @param cellSize - World-unit size of each visual cell.
 * @param palette  - Palette used to resolve colour index → hex/code.
 * @returns Array of visual bead entries to draw.
 */
export function buildBeadEntries(
  map: Map<string, number>,
  view: ViewRect,
  lodScale: number,
  cellSize: number,
  palette: Palette,
): BeadEntry[] {
  return BeadRenderer.entries(new Grid(palette, map), view, lodScale, cellSize)
}

/**
 * Imperative canvas API surfaced to parent components (via a ref) by the
 * canvas wrapper. Declared here (not in the component) so state hooks that
 * store the API can import the type without depending on the component.
 */
export interface PixiCanvasApi {
  setZoom: (z: number | ((prev: number) => number)) => void
  /** Fit the view to the painted grid's bounding box. */
  fitToCanvas: () => void
  /** Empty the canvas (undoable). */
  clearCanvas: () => void
  undo: () => void
  redo: () => void
  getCellsData: () => CellsData | null
  /** Live per-colour bead counts + painted dims (null when the grid is empty). */
  getBeadStats: () => BeadStats | null
  /** Replace the canvas contents with a serialized code grid. When `seed` is
   *  true (initial load of an existing pattern), the loaded grid becomes the
   *  history baseline instead of an undoable step. */
  loadGrid: (grid: string[][], seed?: boolean) => void
}
