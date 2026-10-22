import type { Palette } from "@pindou/shared/types"

/**
 * Code / index / hex lookups over a palette.
 *
 * The sparse grid stores 1‑based indices into `palette.colors`, while the
 * wire and storage formats use stable colour codes. Precomputing the maps once
 * per palette keeps the code↔index conversion out of every cell loop.
 */
export class PaletteIndex {
  private readonly indexByCode = new Map<string, number>()
  private readonly hexByCode = new Map<string, string>()

  /**
   * @param palette - The palette to index. Colours are numbered from 1 in
   *   array order, matching the sparse grid's index convention.
   */
  constructor(readonly palette: Palette) {
    palette.colors.forEach((color, i) => {
      this.indexByCode.set(color.code, i + 1)
      this.hexByCode.set(color.code, color.hex)
    })
  }

  /**
   * Resolve a colour code to its 1‑based palette index.
   *
   * @param code - The colour code (e.g. `"A1"`).
   * @returns The 1‑based index, or `undefined` when the code is not in the palette.
   */
  indexOf(code: string): number | undefined {
    return this.indexByCode.get(code)
  }

  /**
   * Resolve a 1‑based palette index to its colour code.
   *
   * @param index - The 1‑based index.
   * @returns The colour code, or `undefined` when the index is out of range.
   */
  codeOf(index: number): string | undefined {
    return this.palette.colors[index - 1]?.code
  }

  /**
   * Resolve a colour code to its hex colour.
   *
   * @param code - The colour code (e.g. `"A1"`).
   * @returns The hex string, or `undefined` when the code is not in the palette.
   */
  hexOf(code: string): string | undefined {
    return this.hexByCode.get(code)
  }

  /**
   * A copy of every code → hex pair in the palette.
   *
   * @returns A new map, safe for callers to keep or mutate.
   */
  hexMap(): Map<string, string> {
    return new Map(this.hexByCode)
  }
}
