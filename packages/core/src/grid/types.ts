/**
 * Geometry and statistics types shared by the grid model, the renderer, and
 * the canvas hook.
 *
 * They live here (rather than in `editor.ts`) so the classes under `grid/` can
 * reference them without importing the public entry point — `editor.ts`
 * re-exports every one of them, so the public API is unchanged.
 */

/** Bounding box of painted cells in data-cell coordinates. */
export interface GridBounds {
  minC: number
  maxC: number
  minR: number
  maxR: number
}

/** Per-colour bead counts plus the painted bounding-box size and total. */
export interface BeadStats {
  width: number
  height: number
  total: number
  rows: { code: string; count: number }[]
}

/** Axis-aligned viewport rectangle in world space. */
export interface ViewRect {
  left: number
  top: number
  right: number
  bottom: number
}

/** One axis-aligned rectangle describing a grid line, in world units. */
export interface GridRect {
  x: number
  y: number
  width: number
  height: number
}

/** Descriptor for one visual bead rectangle to be drawn. */
export interface BeadEntry {
  worldX: number
  worldY: number
  size: number
  hex: string
  code: string
}
