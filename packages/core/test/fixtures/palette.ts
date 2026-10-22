import type { Color, Palette } from "@pindou/shared/types"

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
export const PALETTE: Palette = {
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

/** A second palette with the same codes in a different order (indices shift). */
export const REORDERED_PALETTE: Palette = {
  ...PALETTE,
  code: "test-reordered",
  colors: [PALETTE.colors[2], PALETTE.colors[0], PALETTE.colors[3], PALETTE.colors[1]],
}
