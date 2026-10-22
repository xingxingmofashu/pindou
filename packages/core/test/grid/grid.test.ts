import { describe, expect, it } from "vitest"
import { CodeGrid } from "../../src/grid/code-grid"
import { EMPTY, Grid } from "../../src/grid/grid"
import { GridHistory } from "../../src/grid/grid-history"
import { PaletteIndex } from "../../src/palette/palette-index"
import { PALETTE, REORDERED_PALETTE } from "../fixtures/palette"

/** Build a sparse grid from `[key, 1-based index]` pairs. */
function makeGrid(entries: [string, number][] = []): Grid {
  return new Grid(PALETTE, new Map(entries))
}

describe("Grid", () => {
  it("takes the cell map by reference", () => {
    const cells = new Map<string, number>([["0,0", 1]])
    const grid = new Grid(PALETTE, cells)

    cells.set("1,0", 2)

    expect(grid.size).toBe(2)
    expect(grid.at(1, 0)).toBe(2)
  })

  it("reads cells and reports EMPTY out of bounds", () => {
    const grid = makeGrid([["2,3", 4]])

    expect(grid.at(2, 3)).toBe(4)
    expect(grid.at(0, 0)).toBe(EMPTY)
    expect(grid.size).toBe(1)
  })

  it("clears every cell in place", () => {
    const cells = new Map<string, number>([["0,0", 1]])
    const grid = new Grid(PALETTE, cells)

    grid.clear()

    expect(grid.size).toBe(0)
    expect(cells.size).toBe(0)
  })

  it("clones the cells without sharing the map", () => {
    const grid = makeGrid([["0,0", 1]])
    const copy = grid.clone()

    copy.paintBlock(1, 0, 2, 1, 2)

    expect(grid.size).toBe(1)
    expect(copy.size).toBe(2)
    expect(copy.palette).toBe(grid.palette)
  })

  it("compares cells by content and ignores the palette", () => {
    const a = new Grid(PALETTE, new Map([["0,0", 1]]))
    const b = new Grid(REORDERED_PALETTE, new Map([["0,0", 1]]))
    const c = new Grid(PALETTE, new Map([["0,0", 2]]))

    expect(a.equals(b)).toBe(true)
    expect(a.equals(c)).toBe(false)
  })

  it("finds the dominant index in a half-open rectangle", () => {
    const grid = makeGrid([
      ["0,0", 1],
      ["1,0", 2],
      ["0,1", 1],
    ])

    expect(grid.dominant(0, 0, 2, 2)).toBe(1)
    expect(grid.dominant(1, 0, 2, 1)).toBe(2)
    expect(grid.dominant(5, 5, 6, 6)).toBeUndefined()
  })

  it("keeps the first index on a dominant-count tie", () => {
    const grid = makeGrid([
      ["0,0", 2],
      ["1,0", 1],
    ])

    expect(grid.dominant(0, 0, 2, 1)).toBe(2)
  })

  it("paints a scaled line as LOD-sized blocks", () => {
    const grid = makeGrid()

    grid.paintLine(0, 0, 2, 0, 1, 2)

    expect(grid.size).toBe(3 * 2 * 2)
    expect(grid.at(0, 0)).toBe(1)
    expect(grid.at(5, 1)).toBe(1)
    expect(grid.at(6, 0)).toBe(EMPTY)
  })

  it("serialises to a bounding-box-cropped code grid", () => {
    const grid = makeGrid([
      ["1,1", 1],
      ["2,2", 2],
    ])

    expect(grid.toCodeGrid()?.codes).toEqual([
      ["A1", ""],
      ["", "A2"],
    ])
  })
})

describe("CodeGrid", () => {
  it("returns null for grids with no cells", () => {
    expect(CodeGrid.from([])).toBeNull()
    expect(CodeGrid.from([[]])).toBeNull()
  })

  it("reads cells and reports an empty string out of bounds", () => {
    const grid = CodeGrid.from([
      ["A1", ""],
      ["", "B1"],
    ])!

    expect(grid.at(0, 0)).toBe("A1")
    expect(grid.at(1, 1)).toBe("B1")
    expect(grid.at(1, 0)).toBe("")
    expect(grid.at(9, 9)).toBe("")
  })

  it("reports dimensions from the first row", () => {
    const grid = CodeGrid.from([
      ["A1", "", "B1"],
      ["", "A2", ""],
    ])!

    expect(grid.size).toEqual({ rows: 2, cols: 3 })
  })

  it("rebuilds a sparse grid, skipping codes outside the palette", () => {
    const grid = CodeGrid.from([
      ["A1", "Z9"],
      ["", "B2"],
    ])!

    const sparse = grid.toGrid(PALETTE)

    const seen: [string, number][] = []
    sparse.forEachPainted((colorIdx, c, r) => seen.push([`${c},${r}`, colorIdx]))

    expect(seen).toEqual([
      ["0,0", 1],
      ["1,1", 4],
    ])
  })
})

describe("GridHistory", () => {
  const g0 = makeGrid()
  const g1 = makeGrid([["0,0", 1]])
  const g2 = makeGrid([["1,0", 2]])
  const g3 = makeGrid([["2,0", 3]])

  it("records a change and restores it", () => {
    const history = new GridHistory()

    history.push(g0, g1)

    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)
    expect(history.undo(g1)?.equals(g0)).toBe(true)
    expect(history.canRedo).toBe(true)
    expect(history.redo(g0)?.equals(g1)).toBe(true)
  })

  it("drops no-op pushes", () => {
    const history = new GridHistory()

    history.push(g1.clone(), g1)

    expect(history.canUndo).toBe(false)
  })

  it("clears the redo stack on a new push", () => {
    const history = new GridHistory()
    history.push(g0, g1)
    history.undo(g1)

    history.push(g1, g2)

    expect(history.canRedo).toBe(false)
  })

  it("keeps at most `limit` undo entries", () => {
    const history = new GridHistory(2)
    history.push(g0, g1)
    history.push(g1, g2)
    history.push(g2, g3)

    const first = history.undo(g3)!
    const second = history.undo(first)!

    expect(first.equals(g2)).toBe(true)
    expect(second.equals(g1)).toBe(true)
    expect(history.undo(second)).toBeNull()
  })

  it("clears both stacks", () => {
    const history = new GridHistory()
    history.push(g0, g1)
    history.undo(g1)

    history.clear()

    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })
})

describe("PaletteIndex", () => {
  const index = new PaletteIndex(PALETTE)

  it("resolves codes to 1-based indices and back", () => {
    expect(index.indexOf("A2")).toBe(2)
    expect(index.codeOf(3)).toBe("B1")
    expect(index.indexOf("Z9")).toBeUndefined()
    expect(index.codeOf(0)).toBeUndefined()
    expect(index.codeOf(99)).toBeUndefined()
  })

  it("resolves codes to hex colours", () => {
    expect(index.hexOf("B1")).toBe("#0000ff")
    expect(index.hexOf("Z9")).toBeUndefined()
    expect(index.hexMap().size).toBe(4)
  })
})
