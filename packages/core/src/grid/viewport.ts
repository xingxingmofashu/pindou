import { CELL, MIN_PX } from "@pindou/shared/constants"
import type { GridBounds } from "./grid"

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

/**
 * Viewport geometry for a given zoom level: painted-bounds centring, the LOD
 * factor, and the grid-line rectangles.
 *
 * Pure math — the caller owns the PixiJS `world` container and applies the
 * returned offsets itself.
 */
export class Viewport {
  /**
   * The world-unit extent of a painted region's bounding box.
   *
   * @param bounds - The bounding box of painted cells.
   * @returns `{ ww, wh }` — the width/height in world units.
   */
  static boundsSize(bounds: GridBounds): { ww: number; wh: number } {
    return {
      ww: (bounds.maxC - bounds.minC + 1) * CELL,
      wh: (bounds.maxR - bounds.minR + 1) * CELL,
    }
  }

  /**
   * The world offset that centres a painted region in the viewport.
   *
   * @param bounds  - The bounding box of painted cells.
   * @param screenW - Viewport width in screen pixels.
   * @param screenH - Viewport height in screen pixels.
   * @param zoom    - Current zoom level.
   * @returns The `world.x` / `world.y` values to apply.
   */
  static center(
    bounds: GridBounds,
    screenW: number,
    screenH: number,
    zoom: number,
  ): { x: number; y: number } {
    const { ww, wh } = Viewport.boundsSize(bounds)
    const ox = bounds.minC * CELL
    const oy = bounds.minR * CELL
    return {
      x: (screenW - ww * zoom) / 2 - ox * zoom,
      y: (screenH - wh * zoom) / 2 - oy * zoom,
    }
  }

  /**
   * @param zoom - Current zoom level (screen pixels per world unit).
   */
  constructor(readonly zoom: number) {}

  /**
   * LOD parameters for the current zoom level.
   *
   * The visual cell size is chosen so that each visual cell is at least
   * {@link MIN_PX} screen pixels wide.
   *
   * @returns `{ scale, size }` where `scale` is the LOD factor and `size` is
   *          the world-unit size of a visual cell.
   */
  lod(): { scale: number; size: number } {
    const px = this.zoom * CELL
    const scale = Math.max(1, Math.ceil(MIN_PX / px))
    return { scale, size: scale * CELL }
  }

  /**
   * Compute the grid-line rectangles for the visible viewport.
   *
   * Renderer-agnostic: returns world-space rectangles for the caller to draw.
   * Each line is snapped to a whole screen pixel (the line is one screen pixel
   * wide, so a fractional position would antialias it across two pixels and
   * fade it to near-invisibility at the grid's low alpha).
   *
   * @param view     - Visible viewport rectangle in world space.
   * @param cellSize - World-unit size of each visual cell.
   * @returns The grid-line rectangles covering the viewport (plus a margin),
   *          and the computed line width.
   */
  gridLines(view: ViewRect, cellSize: number): { rects: GridRect[]; lineWidth: number } {
    const lineWidth = 1 / this.zoom
    const m = cellSize * 2
    const x0 = Math.floor((view.left - m) / cellSize) * cellSize
    const y0 = Math.floor((view.top - m) / cellSize) * cellSize
    const x1 = view.right + m
    const y1 = view.bottom + m
    const hSpan = view.bottom - view.top + m * 2
    const wSpan = view.right - view.left + m * 2

    const rects: GridRect[] = []
    for (let x = x0; x <= x1; x += cellSize) {
      const sx = Math.round((x - view.left) * this.zoom)
      rects.push({
        x: view.left + sx / this.zoom,
        y: view.top - m,
        width: lineWidth,
        height: hSpan,
      })
    }
    for (let y = y0; y <= y1; y += cellSize) {
      const sy = Math.round((y - view.top) * this.zoom)
      rects.push({
        x: view.left - m,
        y: view.top + sy / this.zoom,
        width: wSpan,
        height: lineWidth,
      })
    }
    return { rects, lineWidth }
  }
}
