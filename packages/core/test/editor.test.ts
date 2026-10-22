import { describe, expect, it } from "vitest"
import { CELL, MAX_GRID_DIMENSION } from "@pindou/shared/constants"
import { BeadRenderer } from "../src/grid/bead-renderer"
import { CodeGrid } from "../src/grid/code-grid"
import { EMPTY, Grid } from "../src/grid/grid"
import { Path } from "../src/grid/path"
import { Viewport } from "../src/grid/viewport"
import { MostFrequent } from "../src/most-frequent"
import { ColorSeries } from "../src/palette/color-series"
import { PaletteIndex } from "../src/palette/palette-index"
import { PALETTE } from "./fixtures/palette"

/*
 * Characterization suite for the grid model.
 *
 * Originally written against `editor.ts`'s free functions (S0), ported
 * verbatim to the class API at S4. Every assertion is unchanged — only the
 * call shape moved. Two behaviours are deliberately pinned because a refactor
 * is likely to flip them without anyone noticing:
 *   - `Grid.toCodeGrid` crops from the painted bounding box, not from (0, 0).
 *   - `CodeGrid.forEachPainted` reports `(code, col, row)` — column first.
 *     REFACTOR.md §4.7 flips the legacy `(code, row, col)` order; the 3×2 case
 *     below is the canary.
 */

describe("Grid.boundsOf / Grid#bounds", () => {
  it("returns null for an empty grid", () => {
    expect(Grid.boundsOf(new Map())).toBeNull()
    expect(new Grid(PALETTE, new Map()).bounds()).toBeNull()
  })

  it("spans negative and positive coordinates", () => {
    const cells = new Map<string, number>([
      ["-2,3", 1],
      ["4,-5", 2],
      ["0,0", 1],
    ])

    expect(Grid.boundsOf(cells)).toEqual({ minC: -2, maxC: 4, minR: -5, maxR: 3 })
  })
})

describe("Grid#stats", () => {
  it("returns null for an empty grid", () => {
    expect(new Grid(PALETTE, new Map()).stats()).toBeNull()
  })

  it("counts per code and measures the painted bounding box", () => {
    const cells = new Map<string, number>([
      ["-1,-1", 1],
      ["0,-1", 1],
      ["-1,0", 2],
    ])

    expect(new Grid(PALETTE, cells).stats()).toEqual({
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

    expect(new Grid(PALETTE, cells).stats()).toEqual({
      width: 2,
      height: 1,
      total: 2,
      rows: [{ code: "A1", count: 1 }],
    })
  })
})

describe("Viewport.boundsSize", () => {
  it("multiplies the inclusive cell span by the cell size", () => {
    expect(Viewport.boundsSize({ minC: 0, maxC: 2, minR: 0, maxR: 1 })).toEqual({
      ww: 3 * CELL,
      wh: 2 * CELL,
    })
  })
})

describe("Viewport.center", () => {
  it("centres the painted bounds without touching the world scale", () => {
    expect(Viewport.center({ minC: 1, maxC: 2, minR: 0, maxR: 0 }, 100, 50, 2)).toEqual({
      x: 10,
      y: 15,
    })
  })
})

describe("Grid#paintBlock", () => {
  it("paints a half-open rectangle in row-major order", () => {
    const grid = new Grid(PALETTE, new Map())

    grid.paintBlock(1, 1, 3, 3, 2)

    const painted: [string, number][] = []
    grid.forEachPainted((colorIdx, c, r) => painted.push([`${c},${r}`, colorIdx]))

    expect(painted).toEqual([
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
    const grid = new Grid(PALETTE, cells)

    grid.paintBlock(0, 0, 2, 1, EMPTY)

    expect([...cells.entries()]).toEqual([["0,1", 1]])
  })
})

describe("Grid#floodFill", () => {
  it("recolours the 4-connected region and stops at other colours", () => {
    const cells = new Map<string, number>([
      ["0,0", 1],
      ["1,0", 1],
      ["2,0", 1],
      ["3,0", 2],
    ])
    const grid = new Grid(PALETTE, cells)

    grid.floodFill(0, 0, 3)

    expect([...cells.entries()]).toEqual([
      ["0,0", 3],
      ["1,0", 3],
      ["2,0", 3],
      ["3,0", 2],
    ])
  })

  it("does not leak across a diagonal", () => {
    const grid = new Grid(
      PALETTE,
      new Map<string, number>([
        ["0,0", 1],
        ["1,1", 1],
      ]),
    )

    grid.floodFill(0, 0, 2)

    expect(grid.at(0, 0)).toBe(2)
    expect(grid.at(1, 1)).toBe(1)
  })

  it("is a no-op when the start cell already has the target colour", () => {
    const cells = new Map<string, number>([
      ["0,0", 1],
      ["1,0", 1],
    ])
    const grid = new Grid(PALETTE, cells)

    grid.floodFill(0, 0, 1)

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
    const grid = new Grid(PALETTE, cells)

    grid.floodFill(0, 0, EMPTY)

    expect([...cells.entries()]).toEqual([["2,0", 2]])
  })

  it("is a no-op on a completely empty canvas", () => {
    const grid = new Grid(PALETTE, new Map())

    grid.floodFill(0, 0, 1)

    expect(grid.size).toBe(0)
  })

  it("bounds a background fill to the painted bounding box padded by one cell", () => {
    const cells = new Map<string, number>([
      ["0,0", 1],
      ["1,0", 1],
      ["0,1", 1],
      ["1,1", 1],
    ])
    const grid = new Grid(PALETTE, cells)

    grid.floodFill(-1, -1, 2)

    // The 2×2 painted block plus the 4×4 padded ring: 16 cells in total.
    expect(grid.size).toBe(16)
    expect([...cells.values()].filter((value) => value === 1)).toHaveLength(4)
    expect(grid.at(-1, -1)).toBe(2)
    expect(grid.at(2, 2)).toBe(2)
    expect(grid.at(-2, 0)).toBe(EMPTY)
    expect(grid.at(3, 0)).toBe(EMPTY)
  })
})

describe("Path.walk", () => {
  /** Collects the visited points of a line from the origin. */
  function path(x1: number, y1: number): [number, number][] {
    const points: [number, number][] = []
    Path.walk(0, 0, x1, y1, (x, y) => points.push([x, y]))
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

describe("Grid#toCodeGrid", () => {
  it("returns null for an empty canvas", () => {
    expect(new Grid(PALETTE, new Map()).toCodeGrid()).toBeNull()
  })

  it("crops to the painted bounding box and leaves holes empty", () => {
    const grid = new Grid(
      PALETTE,
      new Map<string, number>([
        ["5,2", 1],
        ["6,3", 2],
      ]),
    )

    expect(grid.toCodeGrid()?.codes).toEqual([
      ["A1", ""],
      ["", "A2"],
    ])
  })

  it("returns null when either side of the bounding box exceeds the grid limit", () => {
    const tooWide = new Grid(
      PALETTE,
      new Map<string, number>([
        ["0,0", 1],
        [`${MAX_GRID_DIMENSION},0`, 2],
      ]),
    )
    expect(tooWide.toCodeGrid()).toBeNull()

    const tooTall = new Grid(
      PALETTE,
      new Map<string, number>([
        ["0,0", 1],
        [`0,${MAX_GRID_DIMENSION}`, 2],
      ]),
    )
    expect(tooTall.toCodeGrid()).toBeNull()
  })

  it("skips cells whose palette index has no colour", () => {
    const grid = new Grid(
      PALETTE,
      new Map<string, number>([
        ["0,0", 1],
        ["1,0", 99],
      ]),
    )

    expect(grid.toCodeGrid()?.codes).toEqual([["A1", ""]])
  })

  it("round-trips through CodeGrid#toCells, normalising negative coordinates", () => {
    const grid = new Grid(
      PALETTE,
      new Map<string, number>([
        ["-2,-1", 1],
        ["-1,-1", 2],
        ["-2,0", 3],
      ]),
    )

    const codeGrid = grid.toCodeGrid()!
    expect(codeGrid.codes).toEqual([
      ["A1", "A2"],
      ["B1", ""],
    ])

    expect([...codeGrid.toCells(PALETTE).entries()]).toEqual([
      ["0,0", 1],
      ["1,0", 2],
      ["0,1", 3],
    ])
  })
})

describe("CodeGrid#toCells", () => {
  it("resolves codes to 1-based indices by column and row", () => {
    const codeGrid = CodeGrid.from([
      ["A1", "", "A2"],
      ["", "B1", ""],
    ])!

    expect([...codeGrid.toCells(PALETTE).entries()]).toEqual([
      ["0,0", 1],
      ["2,0", 2],
      ["1,1", 3],
    ])
  })

  it("skips codes that are not in the palette", () => {
    const codeGrid = CodeGrid.from([["Z9", "A1"]])!

    expect([...codeGrid.toCells(PALETTE).entries()]).toEqual([["1,0", 1]])
  })
})

describe("CodeGrid#size", () => {
  it("returns null for an empty grid", () => {
    expect(CodeGrid.from([])?.size ?? null).toBeNull()
    expect(CodeGrid.from([[]])?.size ?? null).toBeNull()
  })

  it("reports rows and columns of a non-square grid", () => {
    const codeGrid = CodeGrid.from([
      ["A1", "", "B1"],
      ["", "A2", ""],
    ])!

    expect(codeGrid.size).toEqual({ rows: 2, cols: 3 })
  })
})

describe("CodeGrid#counts / #beadStatsJson", () => {
  const grid = CodeGrid.from([
    ["A1", "", "A1"],
    ["B1", "A1", ""],
  ])!

  it("counts painted cells per code", () => {
    expect([...grid.counts().entries()]).toEqual([
      ["A1", 3],
      ["B1", 1],
    ])
  })

  it("serialises the counts as a code-keyed JSON object", () => {
    expect(grid.beadStatsJson()).toBe('{"A1":3,"B1":1}')
  })
})

describe("PaletteIndex#hexMap", () => {
  it("maps every palette code to its hex", () => {
    expect([...new PaletteIndex(PALETTE).hexMap().entries()]).toEqual([
      ["A1", "#ff0000"],
      ["A2", "#00ff00"],
      ["B1", "#0000ff"],
      ["B2", "#ffff00"],
    ])
  })
})

describe("ColorSeries.group", () => {
  it("groups in first-seen order and keeps item order", () => {
    const groups = ColorSeries.group(PALETTE.colors, (color) => color.series ?? "?")

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

    expect(ColorSeries.group(items, (item) => item.series ?? "?").map((group) => group.series)).toEqual([
      "?",
      "S",
    ])
  })
})

describe("CodeGrid#forEachPainted", () => {
  it("visits cells row-major and reports (code, col, row)", () => {
    const grid = CodeGrid.from([
      ["A1", "", "A2"],
      ["B1", "", ""],
    ])!

    const seen: { code: string; c: number; r: number }[] = []
    grid.forEachPainted((code, c, r) => seen.push({ code, c, r }))

    expect(seen).toEqual([
      { code: "A1", c: 0, r: 0 },
      { code: "A2", c: 2, r: 0 },
      { code: "B1", c: 0, r: 1 },
    ])
  })
})

describe("CodeGrid#forEachPaintedInWindow", () => {
  const grid = CodeGrid.from([
    ["A1", "A2", "B1"],
    ["B2", "", "A1"],
  ])!

  it("visits only painted cells inside the half-open window", () => {
    const seen: { code: string; c: number; r: number }[] = []

    grid.forEachPaintedInWindow({ colStart: 1, colEnd: 3, rowStart: -1, rowEnd: 5 }, (code, c, r) =>
      seen.push({ code, c, r }),
    )

    expect(seen).toEqual([
      { code: "A2", c: 1, r: 0 },
      { code: "B1", c: 2, r: 0 },
      { code: "A1", c: 2, r: 1 },
    ])
  })

  it("returns nothing when the window lies outside the grid", () => {
    const seen: string[] = []

    grid.forEachPaintedInWindow({ colStart: 10, colEnd: 20, rowStart: 0, rowEnd: 2 }, (code) =>
      seen.push(code),
    )

    expect(seen).toEqual([])
  })
})

describe("Viewport#lod", () => {
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
    expect(new Viewport(zoom).lod()).toEqual({ scale, size })
  })
})

describe("Viewport#gridLines", () => {
  const view = { left: 0, top: 0, right: 100, bottom: 100 }

  it("uses a one-screen-pixel line width in world units", () => {
    expect(new Viewport(1).gridLines(view, CELL).lineWidth).toBe(1)
    expect(new Viewport(2).gridLines(view, CELL).lineWidth).toBe(0.5)
    expect(new Viewport(0.5).gridLines(view, CELL).lineWidth).toBe(2)
  })

  it("covers the viewport plus a two-cell margin on both axes", () => {
    const { rects } = new Viewport(1).gridLines(view, CELL)

    // x from -20 to 120 in steps of 10 → 15 verticals, and the same for y.
    expect(rects).toHaveLength(30)
    expect(rects[0]).toEqual({ x: -20, y: -20, width: 1, height: 140 })
    expect(rects[14]).toEqual({ x: 120, y: -20, width: 1, height: 140 })
    expect(rects[15]).toEqual({ x: -20, y: -20, width: 140, height: 1 })
    expect(rects[29]).toEqual({ x: -20, y: 120, width: 140, height: 1 })
  })

  it("snaps line positions to whole screen pixels", () => {
    const { rects } = new Viewport(2).gridLines(view, CELL)

    for (const rect of rects) {
      expect(Number.isInteger(rect.x * 2)).toBe(true)
      expect(Number.isInteger(rect.y * 2)).toBe(true)
    }
  })
})

describe("MostFrequent.of", () => {
  it("returns undefined for an empty map", () => {
    expect(MostFrequent.of(new Map<string, number>())).toBeUndefined()
  })

  it("keeps the first key on a tie", () => {
    expect(
      MostFrequent.of(
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
      MostFrequent.of(
        new Map<number, number>([
          [EMPTY, 5],
          [2, 3],
        ]),
        (key) => key === EMPTY,
      ),
    ).toBe(2)
  })

  it("returns undefined when every key is skipped", () => {
    expect(MostFrequent.of(new Map<number, number>([[EMPTY, 5]]), (key) => key === EMPTY)).toBeUndefined()
  })

  it("ignores keys with a zero count", () => {
    expect(MostFrequent.of(new Map<string, number>([["a", 0]]))).toBeUndefined()
  })
})

describe("BeadRenderer.entries", () => {
  const view = { left: 0, top: 0, right: 100, bottom: 100 }

  it("emits one entry per painted cell at 1:1", () => {
    const grid = new Grid(
      PALETTE,
      new Map<string, number>([
        ["0,0", 1],
        ["1,0", 2],
        ["0,1", 1],
      ]),
    )

    expect(BeadRenderer.entries(grid, view, 1, CELL)).toEqual([
      { worldX: 0, worldY: 0, size: CELL, hex: "#ff0000", code: "A1" },
      { worldX: 10, worldY: 0, size: CELL, hex: "#00ff00", code: "A2" },
      { worldX: 0, worldY: 10, size: CELL, hex: "#ff0000", code: "A1" },
    ])
  })

  it("merges cells into one visual bead per LOD bucket using the dominant colour", () => {
    const grid = new Grid(
      PALETTE,
      new Map<string, number>([
        ["0,0", 1],
        ["1,0", 2],
        ["0,1", 1],
      ]),
    )

    expect(BeadRenderer.entries(grid, view, 2, 2 * CELL)).toEqual([
      { worldX: 0, worldY: 0, size: 2 * CELL, hex: "#ff0000", code: "A1" },
    ])
  })

  it("ignores EMPTY values when picking the dominant colour", () => {
    const grid = new Grid(
      PALETTE,
      new Map<string, number>([
        ["0,0", EMPTY],
        ["1,0", EMPTY],
        ["2,0", 2],
      ]),
    )

    expect(BeadRenderer.entries(grid, view, 4, 4 * CELL)).toEqual([
      { worldX: 0, worldY: 0, size: 4 * CELL, hex: "#00ff00", code: "A2" },
    ])
  })

  it("drops cells outside the viewport margin", () => {
    const grid = new Grid(PALETTE, new Map<string, number>([["500,500", 1]]))

    expect(BeadRenderer.entries(grid, view, 1, CELL)).toEqual([])
  })

  it("drops cells whose palette index has no colour", () => {
    const grid = new Grid(PALETTE, new Map<string, number>([["0,0", 99]]))

    expect(BeadRenderer.entries(grid, view, 1, CELL)).toEqual([])
  })
})
