import { describe, expect, it } from "vitest"
import { CELL, MAX_GRID_DIMENSION } from "@pindou/shared/constants"
import type { Color, Palette } from "@pindou/shared/types"
import {
  EMPTY,
  boundsWorldSize,
  buildBeadEntries,
  buildHexByCode,
  centerViewport,
  computeGridLines,
  countBeadStats,
  countGridBeads,
  deserializeGrid,
  floodFill,
  forEachPaintedCell,
  forEachPaintedCellInWindow,
  getGridBounds,
  gridSize,
  groupColorsBySeries,
  lodParams,
  mostFrequent,
  paintBlock,
  serializeBeadStats,
  serializeGrid,
  walkLine,
} from "../src/editor"

/*
 * Characterization suite for `packages/core/src/editor.ts`.
 *
 * These tests describe what the code does *today*, quirks included — they are
 * the safety net for the class refactor (REFACTOR.md S1–S4), not a spec for an
 * ideal API. When S4 deletes a forwarding function, delete the test block that
 * belongs to it instead of rewriting it: the replacement lives in the class's
 * own suite (`test/grid/*.test.ts`).
 *
 * Two behaviours are deliberately pinned because a refactor is likely to flip
 * them without anyone noticing:
 *   - `serializeGrid` crops from the painted bounding box, not from (0, 0).
 *   - `forEachPaintedCell` reports `(code, row, col)` — row first. REFACTOR.md
 *     §4.7 changes this to `(code, col, row)` for `CodeGrid`, and this test is
 *     the canary that will fail if a call site is migrated by accident.
 */

const BRAND_ID = "00000000-0000-4000-8000-000000000001"

/** Builds a {@link Color} with only the fields the grid logic reads set meaningfully. */
function makeColor(code: string, hex: string, series: string | null, sortOrder: number): Color {
  return {
    id: `color-${code}`,
    fkBrandId: BRAND_ID,
    code,
    name: `Colour ${code}`,
    hex,
    series,
    sortOrder,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }
}

/**
 * Four-colour fixture palette. Array order defines the 1-based indices stored
 * in the sparse grid: A1 = 1, A2 = 2, B1 = 3, B2 = 4.
 */
const PALETTE: Palette = {
  id: BRAND_ID,
  code: "test",
  name: "Test brand",
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  colors: [
    makeColor("A1", "#ff0000", "A", 0),
    makeColor("A2", "#00ff00", "A", 1),
    makeColor("B1", "#0000ff", "B", 2),
    makeColor("B2", "#ffff00", "B", 3),
  ],
}

describe("getGridBounds", () => {
  it("returns null for an empty grid", () => {
    expect(getGridBounds(new Map())).toBeNull()
  })

  it("spans negative and positive coordinates", () => {
    const cells = new Map<string, number>([
      ["-2,3", 1],
      ["4,-5", 2],
      ["0,0", 1],
    ])

    expect(getGridBounds(cells)).toEqual({ minC: -2, maxC: 4, minR: -5, maxR: 3 })
  })
})

describe("countBeadStats", () => {
  it("returns null for an empty grid", () => {
    expect(countBeadStats(new Map(), PALETTE)).toBeNull()
  })

  it("counts per code and measures the painted bounding box", () => {
    const cells = new Map<string, number>([
      ["-1,-1", 1],
      ["0,-1", 1],
      ["-1,0", 2],
    ])

    expect(countBeadStats(cells, PALETTE)).toEqual({
      width: 2,
      height: 2,
      total: 3,
      rows: [
        { code: "A1", count: 2 },
        { code: "A2", count: 1 },
      ],
    })
  })

  it("counts out-of-range palette indices in total but not in rows", () => {
    const cells = new Map<string, number>([
      ["0,0", 1],
      ["1,0", 99],
    ])

    expect(countBeadStats(cells, PALETTE)).toEqual({
      width: 2,
      height: 1,
      total: 2,
      rows: [{ code: "A1", count: 1 }],
    })
  })
})

describe("boundsWorldSize", () => {
  it("multiplies the inclusive cell span by the cell size", () => {
    expect(boundsWorldSize({ minC: 0, maxC: 2, minR: 0, maxR: 1 })).toEqual({
      ww: 3 * CELL,
      wh: 2 * CELL,
    })
  })
})

describe("centerViewport", () => {
  it("centres the painted bounds without touching the world scale", () => {
    const world = { x: 0, y: 0 }

    centerViewport(world, { minC: 1, maxC: 2, minR: 0, maxR: 0 }, 100, 50, 2)

    expect(world).toEqual({ x: 10, y: 15 })
  })
})

describe("paintBlock", () => {
  it("paints a half-open rectangle in row-major order", () => {
    const cells = new Map<string, number>()

    paintBlock(cells, 1, 1, 3, 3, 2)

    expect([...cells.entries()]).toEqual([
      ["1,1", 2],
      ["2,1", 2],
      ["1,2", 2],
      ["2,2", 2],
    ])
  })

  it("removes cells when painting EMPTY", () => {
    const cells = new Map<string, number>([
      ["0,0", 1],
      ["1,0", 1],
      ["0,1", 1],
    ])

    paintBlock(cells, 0, 0, 2, 1, EMPTY)

    expect([...cells.entries()]).toEqual([["0,1", 1]])
  })
})

describe("floodFill", () => {
  it("recolours the 4-connected region and stops at other colours", () => {
    const cells = new Map<string, number>([
      ["0,0", 1],
      ["1,0", 1],
      ["2,0", 1],
      ["3,0", 2],
    ])

    floodFill(cells, 0, 0, 3)

    expect([...cells.entries()]).toEqual([
      ["0,0", 3],
      ["1,0", 3],
      ["2,0", 3],
      ["3,0", 2],
    ])
  })

  it("does not leak across a diagonal", () => {
    const cells = new Map<string, number>([
      ["0,0", 1],
      ["1,1", 1],
    ])

    floodFill(cells, 0, 0, 2)

    expect(cells.get("0,0")).toBe(2)
    expect(cells.get("1,1")).toBe(1)
  })

  it("is a no-op when the start cell already has the target colour", () => {
    const cells = new Map<string, number>([
      ["0,0", 1],
      ["1,0", 1],
    ])

    floodFill(cells, 0, 0, 1)

    expect([...cells.entries()]).toEqual([
      ["0,0", 1],
      ["1,0", 1],
    ])
  })

  it("erases a connected region when filling with EMPTY", () => {
    const cells = new Map<string, number>([
      ["0,0", 1],
      ["1,0", 1],
      ["2,0", 2],
    ])

    floodFill(cells, 0, 0, EMPTY)

    expect([...cells.entries()]).toEqual([["2,0", 2]])
  })

  it("is a no-op on a completely empty canvas", () => {
    const cells = new Map<string, number>()

    floodFill(cells, 0, 0, 1)

    expect(cells.size).toBe(0)
  })

  it("bounds a background fill to the painted bounding box padded by one cell", () => {
    const cells = new Map<string, number>([
      ["0,0", 1],
      ["1,0", 1],
      ["0,1", 1],
      ["1,1", 1],
    ])

    floodFill(cells, -1, -1, 2)

    // The 2×2 painted block plus the 4×4 padded ring: 16 cells in total.
    expect(cells.size).toBe(16)
    expect([...cells.values()].filter((value) => value === 1)).toHaveLength(4)
    expect(cells.get("-1,-1")).toBe(2)
    expect(cells.get("2,2")).toBe(2)
    expect(cells.has("-2,0")).toBe(false)
    expect(cells.has("3,0")).toBe(false)
  })
})

describe("walkLine", () => {
  /** Collects the visited points of a line from the origin. */
  function path(x1: number, y1: number): [number, number][] {
    const points: [number, number][] = []
    walkLine(0, 0, x1, y1, (x, y) => points.push([x, y]))
    return points
  }

  const LINE_CASES: [number, number, [number, number][]][] = [
    [3, 0, [[0, 0], [1, 0], [2, 0], [3, 0]]],
    [-3, 0, [[0, 0], [-1, 0], [-2, 0], [-3, 0]]],
    [0, 3, [[0, 0], [0, 1], [0, 2], [0, 3]]],
    [0, -3, [[0, 0], [0, -1], [0, -2], [0, -3]]],
    [3, 3, [[0, 0], [1, 1], [2, 2], [3, 3]]],
    [-3, -3, [[0, 0], [-1, -1], [-2, -2], [-3, -3]]],
    [3, -3, [[0, 0], [1, -1], [2, -2], [3, -3]]],
    [-3, 3, [[0, 0], [-1, 1], [-2, 2], [-3, 3]]],
  ]

  it.each(LINE_CASES)("walks from the origin to (%i, %i) without gaps", (x1, y1, expected) => {
    expect(path(x1, y1)).toEqual(expected)
  })

  it("visits a single point when start and end coincide", () => {
    expect(path(0, 0)).toEqual([[0, 0]])
  })

  it("interpolates a shallow slope", () => {
    expect(path(3, 2)).toEqual([[0, 0], [1, 1], [2, 1], [3, 2]])
  })
})

describe("serializeGrid", () => {
  it("returns null for an empty canvas", () => {
    expect(serializeGrid(new Map(), PALETTE)).toBeNull()
  })

  it("crops to the painted bounding box and leaves holes empty", () => {
    const cells = new Map<string, number>([
      ["5,2", 1],
      ["6,3", 2],
    ])

    expect(serializeGrid(cells, PALETTE)).toEqual([
      ["A1", ""],
      ["", "A2"],
    ])
  })

  it("returns null when either side of the bounding box exceeds the grid limit", () => {
    const tooWide = new Map<string, number>([
      ["0,0", 1],
      [`${MAX_GRID_DIMENSION},0`, 2],
    ])
    expect(serializeGrid(tooWide, PALETTE)).toBeNull()

    const tooTall = new Map<string, number>([
      ["0,0", 1],
      [`0,${MAX_GRID_DIMENSION}`, 2],
    ])
    expect(serializeGrid(tooTall, PALETTE)).toBeNull()
  })

  it("skips cells whose palette index has no colour", () => {
    const cells = new Map<string, number>([
      ["0,0", 1],
      ["1,0", 99],
    ])

    expect(serializeGrid(cells, PALETTE)).toEqual([["A1", ""]])
  })

  it("round-trips through deserializeGrid, normalising negative coordinates", () => {
    const cells = new Map<string, number>([
      ["-2,-1", 1],
      ["-1,-1", 2],
      ["-2,0", 3],
    ])

    const grid = serializeGrid(cells, PALETTE)!
    expect(grid).toEqual([
      ["A1", "A2"],
      ["B1", ""],
    ])

    expect([...deserializeGrid(grid, PALETTE).entries()]).toEqual([
      ["0,0", 1],
      ["1,0", 2],
      ["0,1", 3],
    ])
  })
})

describe("deserializeGrid", () => {
  it("resolves codes to 1-based indices by column and row", () => {
    const cells = deserializeGrid(
      [
        ["A1", "", "A2"],
        ["", "B1", ""],
      ],
      PALETTE,
    )

    expect([...cells.entries()]).toEqual([
      ["0,0", 1],
      ["2,0", 2],
      ["1,1", 3],
    ])
  })

  it("skips codes that are not in the palette", () => {
    expect([...deserializeGrid([["Z9", "A1"]], PALETTE).entries()]).toEqual([["1,0", 1]])
  })
})

describe("gridSize", () => {
  it("returns null for an empty grid", () => {
    expect(gridSize([])).toBeNull()
    expect(gridSize([[]])).toBeNull()
  })

  it("reports rows and columns of a non-square grid", () => {
    expect(
      gridSize([
        ["A1", "", "B1"],
        ["", "A2", ""],
      ]),
    ).toEqual({ rows: 2, cols: 3 })
  })
})

describe("countGridBeads / serializeBeadStats", () => {
  const grid = [
    ["A1", "", "A1"],
    ["B1", "A1", ""],
  ]

  it("counts painted cells per code", () => {
    expect([...countGridBeads(grid).entries()]).toEqual([
      ["A1", 3],
      ["B1", 1],
    ])
  })

  it("serialises the counts as a code-keyed JSON object", () => {
    expect(serializeBeadStats(grid)).toBe('{"A1":3,"B1":1}')
  })
})

describe("buildHexByCode", () => {
  it("maps every palette code to its hex", () => {
    expect([...buildHexByCode(PALETTE).entries()]).toEqual([
      ["A1", "#ff0000"],
      ["A2", "#00ff00"],
      ["B1", "#0000ff"],
      ["B2", "#ffff00"],
    ])
  })
})

describe("groupColorsBySeries", () => {
  it("groups in first-seen order and keeps item order", () => {
    const groups = groupColorsBySeries(PALETTE.colors, (color) => color.series ?? "?")

    expect(groups.map((group) => group.series)).toEqual(["A", "B"])
    expect(groups[0].colors.map((color) => color.code)).toEqual(["A1", "A2"])
    expect(groups[1].colors.map((color) => color.code)).toEqual(["B1", "B2"])
  })

  it("assigns the '?' bucket when the series is null", () => {
    const items = [
      { code: "X", series: null },
      { code: "Y", series: null },
      { code: "Z", series: "S" },
    ]

    expect(groupColorsBySeries(items, (item) => item.series ?? "?").map((group) => group.series)).toEqual([
      "?",
      "S",
    ])
  })
})

describe("forEachPaintedCell", () => {
  it("visits cells row-major and reports (code, row, col)", () => {
    const grid = [
      ["A1", "", "A2"],
      ["B1", "", ""],
    ]

    const seen: string[] = []
    forEachPaintedCell(grid, (code, row, col) => seen.push(`${code}@${row},${col}`))

    expect(seen).toEqual(["A1@0,0", "A2@0,2", "B1@1,0"])
  })
})

describe("forEachPaintedCellInWindow", () => {
  const grid = [
    ["A1", "A2", "B1"],
    ["B2", "", "A1"],
  ]

  it("visits only painted cells inside the half-open window", () => {
    const seen: string[] = []

    forEachPaintedCellInWindow(
      grid,
      { colStart: 1, colEnd: 3, rowStart: -1, rowEnd: 5 },
      (code, row, col) => seen.push(`${code}@${row},${col}`),
    )

    expect(seen).toEqual(["A2@0,1", "B1@0,2", "A1@1,2"])
  })

  it("returns nothing when the window lies outside the grid", () => {
    const seen: string[] = []

    forEachPaintedCellInWindow(grid, { colStart: 10, colEnd: 20, rowStart: 0, rowEnd: 2 }, (code) =>
      seen.push(code),
    )

    expect(seen).toEqual([])
  })
})

describe("lodParams", () => {
  const LOD_CASES: [number, number, number][] = [
    [20, 1, CELL],
    [3, 1, CELL],
    [1, 1, CELL],
    [0.5, 2, 2 * CELL],
    [0.33, 4, 4 * CELL],
    [0.25, 4, 4 * CELL],
    [0.1, 10, 10 * CELL],
  ]

  it.each(LOD_CASES)("at zoom %f uses LOD scale %i", (zoom, scale, size) => {
    expect(lodParams(zoom)).toEqual({ scale, size })
  })
})

describe("computeGridLines", () => {
  const view = { left: 0, top: 0, right: 100, bottom: 100 }

  it("uses a one-screen-pixel line width in world units", () => {
    expect(computeGridLines(view, CELL, 1).lineWidth).toBe(1)
    expect(computeGridLines(view, CELL, 2).lineWidth).toBe(0.5)
    expect(computeGridLines(view, CELL, 0.5).lineWidth).toBe(2)
  })

  it("covers the viewport plus a two-cell margin on both axes", () => {
    const { rects } = computeGridLines(view, CELL, 1)

    // x from -20 to 120 in steps of 10 → 15 verticals, and the same for y.
    expect(rects).toHaveLength(30)
    expect(rects[0]).toEqual({ x: -20, y: -20, width: 1, height: 140 })
    expect(rects[14]).toEqual({ x: 120, y: -20, width: 1, height: 140 })
    expect(rects[15]).toEqual({ x: -20, y: -20, width: 140, height: 1 })
    expect(rects[29]).toEqual({ x: -20, y: 120, width: 140, height: 1 })
  })

  it("snaps line positions to whole screen pixels", () => {
    const { rects } = computeGridLines(view, CELL, 2)

    for (const rect of rects) {
      expect(Number.isInteger(rect.x * 2)).toBe(true)
      expect(Number.isInteger(rect.y * 2)).toBe(true)
    }
  })
})

describe("mostFrequent", () => {
  it("returns undefined for an empty map", () => {
    expect(mostFrequent(new Map<string, number>())).toBeUndefined()
  })

  it("keeps the first key on a tie", () => {
    expect(
      mostFrequent(
        new Map<string, number>([
          ["a", 2],
          ["b", 2],
          ["c", 1],
        ]),
      ),
    ).toBe("a")
  })

  it("honours the skip predicate", () => {
    expect(
      mostFrequent(
        new Map<number, number>([
          [EMPTY, 5],
          [2, 3],
        ]),
        (key) => key === EMPTY,
      ),
    ).toBe(2)
  })

  it("returns undefined when every key is skipped", () => {
    expect(mostFrequent(new Map<number, number>([[EMPTY, 5]]), (key) => key === EMPTY)).toBeUndefined()
  })

  it("ignores keys with a zero count", () => {
    expect(mostFrequent(new Map<string, number>([["a", 0]]))).toBeUndefined()
  })
})

describe("buildBeadEntries", () => {
  const view = { left: 0, top: 0, right: 100, bottom: 100 }

  it("emits one entry per painted cell at 1:1", () => {
    const cells = new Map<string, number>([
      ["0,0", 1],
      ["1,0", 2],
      ["0,1", 1],
    ])

    expect(buildBeadEntries(cells, view, 1, CELL, PALETTE)).toEqual([
      { worldX: 0, worldY: 0, size: CELL, hex: "#ff0000", code: "A1" },
      { worldX: 10, worldY: 0, size: CELL, hex: "#00ff00", code: "A2" },
      { worldX: 0, worldY: 10, size: CELL, hex: "#ff0000", code: "A1" },
    ])
  })

  it("merges cells into one visual bead per LOD bucket using the dominant colour", () => {
    const cells = new Map<string, number>([
      ["0,0", 1],
      ["1,0", 2],
      ["0,1", 1],
    ])

    expect(buildBeadEntries(cells, view, 2, 2 * CELL, PALETTE)).toEqual([
      { worldX: 0, worldY: 0, size: 2 * CELL, hex: "#ff0000", code: "A1" },
    ])
  })

  it("ignores EMPTY values when picking the dominant colour", () => {
    const cells = new Map<string, number>([
      ["0,0", EMPTY],
      ["1,0", EMPTY],
      ["2,0", 2],
    ])

    expect(buildBeadEntries(cells, view, 4, 4 * CELL, PALETTE)).toEqual([
      { worldX: 0, worldY: 0, size: 4 * CELL, hex: "#00ff00", code: "A2" },
    ])
  })

  it("drops cells outside the viewport margin", () => {
    const cells = new Map<string, number>([["500,500", 1]])

    expect(buildBeadEntries(cells, view, 1, CELL, PALETTE)).toEqual([])
  })

  it("drops cells whose palette index has no colour", () => {
    const cells = new Map<string, number>([["0,0", 99]])

    expect(buildBeadEntries(cells, view, 1, CELL, PALETTE)).toEqual([])
  })
})
