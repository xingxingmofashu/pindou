import type { Application, Container, Graphics } from "pixi.js"
import type { BeadStats } from "./grid/types"

/**
 * Public entry point for the grid model.
 *
 * This module exports **types and classes only** — the former free
 * `serializeGrid` / `forEachPaintedCell` / `gridSize` … helpers were removed in
 * favour of the classes below (REFACTOR.md S4). Each class owns one
 * representation or one responsibility:
 *
 * - {@link Grid}       — sparse, mutable, 1-based palette indices (editor state)
 * - {@link CodeGrid}   — dense, immutable, colour codes (storage / wire format)
 * - {@link GridHistory}— undo/redo snapshots of a `Grid`
 * - {@link Viewport}   — centring, LOD, and grid-line geometry
 * - {@link BeadRenderer} — draw list for the bead layer
 * - {@link PaletteIndex} — code ↔ index ↔ hex lookups
 * - {@link ColorSeries}  — palette grouping
 * - {@link Path}         — Bresenham rasterisation
 * - {@link MostFrequent} — frequency-map selection
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

/** PixiJS scene-graph objects passed between `usePixiApp` and `usePixiCanvas`. */
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
