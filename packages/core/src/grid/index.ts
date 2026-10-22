/**
 * The grid model: one representation per class, plus the geometry/statistics
 * types they exchange.
 *
 * - {@link Grid}        — sparse, mutable, 1-based palette indices (editor state)
 * - {@link CodeGrid}    — dense, immutable, colour codes (storage / wire format)
 * - {@link GridHistory} — undo/redo snapshots of a `Grid`
 * - {@link Viewport}    — centring, LOD, and grid-line geometry
 * - {@link BeadRenderer}— draw list for the bead layer
 * - {@link Path}        — Bresenham rasterisation
 */
export { EMPTY, Grid } from "./grid"
export type { BeadStats, GridBounds } from "./grid"
export { CodeGrid } from "./code-grid"
export { GridHistory } from "./grid-history"
export { Viewport } from "./viewport"
export type { GridRect, ViewRect } from "./viewport"
export { BeadRenderer } from "./bead-renderer"
export type { BeadEntry } from "./bead-renderer"
export { Path } from "./path"
