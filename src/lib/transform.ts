import { converter } from "culori"
import { MAX_GRID_CELLS, MAX_GRID_DIMENSION } from "@/lib/constants"
import { countGridBeads, mostFrequent } from "@/lib/editor"
import type { Palette } from "@/types"

/** Pixels with alpha below this are treated as empty cells. */
const ALPHA_THRESHOLD = 128
/** Source long side is never pre-scaled beyond this. */
const MAX_SOURCE_SIDE = 2048
/** Source is scaled at least to this long side for stable per-cell averaging. */
const MIN_SOURCE_SIDE = 256
/** Pre-scale keeps roughly this many sub-samples per target cell. */
const SAMPLES_PER_CELL = 12

const toOklab = converter("oklab")

/** How a cell's source pixels collapse into one representative colour. */
export type TransformMode = "average" | "dominant"

export interface TransformOptions {
  /** Target width in beads. */
  width: number
  /**
   * `"average"` blends the cell's pixels (photos — smooth, noise-free);
   * `"dominant"` picks the most common exact RGB (illustrations — crisp).
   */
  mode?: TransformMode
  /**
   * Merge low-frequency colours into the most frequent colour within this
   * OKLab distance (0 disables). Removes scattered noise colours.
   */
  mergeSimilarity?: number
  /** Flood-fill the border-connected dominant colour and empty those cells. */
  removeBackground?: boolean
}

export interface TransformResult {
  /** grid[row][col], "" = empty, otherwise a brand colour code (e.g. "A1"). */
  grid: string[][]
  /** Number of columns. */
  width: number
  /** Number of rows. */
  height: number
  /** Non-empty cells. */
  beadCount: number
}

/** A single RGB colour. */
interface RgbColor {
  r: number
  g: number
  b: number
}

/** Raw RGBA pixels — a `Uint8Array` (sharp) or `Uint8ClampedArray` (canvas). */
type RgbaPixels = Uint8Array | Uint8ClampedArray

/**
 * One image → bead-grid conversion. Holds the palette's precomputed OKLab
 * samples once and shares them between nearest-colour matching and the
 * similarity merge (building them twice was the previous waste).
 */
export class Transform {
  /** OKLab (l, a, b) per palette color, aligned with {@link codes}. */
  private readonly samples: [number, number, number][] = []
  /** Palette colour code per sample, aligned by index. */
  private readonly codes: string[] = []
  /** Sample index per colour code (for the similarity merge). */
  private readonly indexByCode = new Map<string, number>()

  constructor(palette: Palette) {
    for (const color of palette.colors) {
      // Palette hexes come from the DB (validated 6-digit values); culori's
      // string-input conversions type as `| undefined` but cannot fail here.
      const o = toOklab(color.hex)!
      this.samples.push([o.l, o.a, o.b])
      this.codes.push(color.code)
      this.indexByCode.set(color.code, this.samples.length - 1)
    }
  }

  /**
   * Collapse a cell's source-pixel region into one representative RGB colour —
   * the average in `average` mode, the most frequent exact RGB in `dominant` —
   * or null when every pixel is transparent.
   *
   * @param data      - Raw RGBA source pixels.
   * @param srcWidth  - Raw source width (row stride).
   * @param x0/y0/x1/y1 - Cell bounds in source pixels (half-open).
   * @param mode      - Representative-colour strategy.
   * @returns The representative colour, or null for an empty cell.
   */
  private static cellRepresentative(
    data: RgbaPixels,
    srcWidth: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    mode: TransformMode,
  ): RgbColor | null {
    let rSum = 0
    let gSum = 0
    let bSum = 0
    let pixelCount = 0
    let domKey = 0
    let domCount = 0
    const freq = mode === "dominant" ? new Map<number, number>() : null

    for (let sy = y0; sy < y1; sy++) {
      let i = (sy * srcWidth + x0) * 4
      for (let sx = x0; sx < x1; sx++, i += 4) {
        if (data[i + 3] < ALPHA_THRESHOLD) continue
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        pixelCount++
        if (freq) {
          const key = (r << 16) | (g << 8) | b
          const n = (freq.get(key) ?? 0) + 1
          freq.set(key, n)
          if (n > domCount) {
            domCount = n
            domKey = key
          }
        } else {
          rSum += r
          gSum += g
          bSum += b
        }
      }
    }

    if (pixelCount === 0) return null
    if (freq) {
      return { r: (domKey >> 16) & 0xff, g: (domKey >> 8) & 0xff, b: domKey & 0xff }
    }
    return {
      r: Math.round(rSum / pixelCount),
      g: Math.round(gSum / pixelCount),
      b: Math.round(bSum / pixelCount),
    }
  }

  /**
   * Clamp a requested bead-grid width (and the height derived from it) to the
   * publishable budget — per-side {@link MAX_GRID_DIMENSION} and total
   * {@link MAX_GRID_CELLS} — preserving the source aspect ratio.
   *
   * @param srcW           - Source image width in pixels.
   * @param srcH           - Source image height in pixels.
   * @param requestedWidth - Target width in beads.
   * @returns The final grid dimensions in beads.
   */
  static resolveGridSize(
    srcW: number,
    srcH: number,
    requestedWidth: number,
  ): { width: number; height: number } {
    let width = Math.min(Math.max(1, Math.round(requestedWidth)), MAX_GRID_DIMENSION)
    let height = Math.min(
      Math.max(1, Math.round((width * srcH) / srcW)),
      MAX_GRID_DIMENSION,
    )

    // Keep the output within the publishable cell budget: a 4096-wide portrait
    // could otherwise produce a grid that exceeds MAX_GRID_CELLS and then fail
    // the schema check on publish. Scaling both sides keeps the aspect ratio.
    if (width * height > MAX_GRID_CELLS) {
      const scale = Math.sqrt(MAX_GRID_CELLS / (width * height))
      width = Math.max(1, Math.floor(width * scale))
      height = Math.max(1, Math.floor(height * scale))
    }
    return { width, height }
  }

  /**
   * Cap the source long side for pre-scaling, so each target cell covers
   * roughly {@link SAMPLES_PER_CELL}² source pixels without exceeding
   * {@link MAX_SOURCE_SIDE}.
   *
   * @param width  - Target grid width in beads.
   * @param height - Target grid height in beads.
   * @returns The long-side cap, in source pixels.
   */
  static resolvePrescaleCap(width: number, height: number): number {
    const targetSide = Math.max(width, height)
    return Math.min(
      MAX_SOURCE_SIDE,
      Math.max(MIN_SOURCE_SIDE, targetSide * SAMPLES_PER_CELL),
    )
  }

  /**
   * Map an RGB colour to the closest palette color index (0-based) by OKLab
   * euclidean distance — OKLab is perceptually uniform, so the nearest colour
   * is also the most visually similar.
   */
  private nearestColorIndex(r: number, g: number, b: number): number {
    const ok = toOklab({ mode: "rgb" as const, r: r / 255, g: g / 255, b: b / 255 })
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < this.samples.length; i++) {
      const [pl, pa, pb] = this.samples[i]
      const dl = ok.l - pl
      const da = ok.a - pa
      const db = ok.b - pb
      const d = dl * dl + da * da + db * db
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }

  /** Euclidean distance between two OKLab triples. */
  private oklabDistance(
    a: [number, number, number],
    b: [number, number, number],
  ): number {
    const dl = a[0] - b[0]
    const da = a[1] - b[1]
    const db = a[2] - b[2]
    return Math.sqrt(dl * dl + da * da + db * db)
  }

  /**
   * Merge low-frequency colours into the most frequent colour within an OKLab
   * distance threshold, applied in place. Iterates colour codes from most to
   * least frequent and records a low → high replacement map once, then rewrites
   * the grid in a single pass.
   *
   * @param grid      - The code grid to rewrite in place ("" = empty).
   * @param threshold - Maximum OKLab distance between the merged pair.
   */
  private mergeSimilarColors(grid: string[][], threshold: number): void {
    const counts = countGridBeads(grid)
    if (counts.size < 2) return

    const codes = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([code]) => code)

    const replacement = new Map<string, string>()
    for (let i = 0; i < codes.length; i++) {
      const high = codes[i]
      if (replacement.has(high)) continue
      const highIdx = this.indexByCode.get(high)
      if (highIdx === undefined) continue
      const highOk = this.samples[highIdx]
      for (let j = i + 1; j < codes.length; j++) {
        const low = codes[j]
        if (replacement.has(low)) continue
        const lowIdx = this.indexByCode.get(low)
        if (lowIdx === undefined) continue
        if (this.oklabDistance(highOk, this.samples[lowIdx]) < threshold) {
          replacement.set(low, high)
        }
      }
    }
    if (replacement.size === 0) return

    for (const row of grid) {
      for (let c = 0; c < row.length; c++) {
        const target = replacement.get(row[c])
        if (target) row[c] = target
      }
    }
  }

  /**
   * Flood-fill the border-connected dominant colour and empty those cells, in
   * place. Counts colours on the outer ring, takes the most frequent as the
   * background, then from every matching border cell BFS-fills same-coloured
   * neighbours — interior regions of the same colour are left untouched.
   *
   * @param grid - The code grid to rewrite in place ("" = empty).
   */
  private removeBackgroundColor(grid: string[][]): void {
    const h = grid.length
    const w = grid[0]?.length ?? 0
    if (h === 0 || w === 0) return

    const borderCounts = new Map<string, number>()
    const count = (code: string) => {
      if (code === "") return
      borderCounts.set(code, (borderCounts.get(code) ?? 0) + 1)
    }
    for (let c = 0; c < w; c++) {
      count(grid[0][c])
      count(grid[h - 1][c])
    }
    for (let r = 1; r < h - 1; r++) {
      count(grid[r][0])
      count(grid[r][w - 1])
    }

    const bg = mostFrequent(borderCounts)
    if (!bg) return

    const visited = new Uint8Array(w * h)
    const stack: number[] = []
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if ((r === 0 || r === h - 1 || c === 0 || c === w - 1) && grid[r][c] === bg) {
          const idx = r * w + c
          visited[idx] = 1
          stack.push(idx)
        }
      }
    }

    const visit = (nr: number, nc: number) => {
      if (nr < 0 || nr >= h || nc < 0 || nc >= w) return
      const nIdx = nr * w + nc
      if (visited[nIdx] || grid[nr][nc] !== bg) return
      visited[nIdx] = 1
      stack.push(nIdx)
    }

    while (stack.length > 0) {
      const idx = stack.pop()!
      const r = Math.floor(idx / w)
      const c = idx % w
      grid[r][c] = ""
      visit(r + 1, c)
      visit(r - 1, c)
      visit(r, c + 1)
      visit(r, c - 1)
    }
  }

  /**
   * Quantize a raw RGBA source buffer into a bead grid.
   *
   * The caller has already decoded and pre-scaled the source (on the server via
   * sharp, on the client via the import Web Worker + canvas). Each target cell
   * first collapses its source-pixel region into a single representative colour
   * — the RGB average for photos, or the most frequent exact RGB for
   * illustrations — and that representative is then mapped to the nearest
   * palette colour. Averaging before quantizing (rather than quantizing each
   * pixel and voting) keeps gradients smooth and free of scattered noise.
   *
   * @param data      - Raw RGBA pixels (row-major, 4 bytes per pixel).
   * @param srcWidth  - Source width in pixels.
   * @param srcHeight - Source height in pixels.
   * @param opts      - Target width and optional mode / merge / background.
   * @returns The dense code grid plus dimensions and bead count.
   */
  quantize(
    data: RgbaPixels,
    srcWidth: number,
    srcHeight: number,
    opts: TransformOptions,
  ): TransformResult {
    const { width, height } = Transform.resolveGridSize(srcWidth, srcHeight, opts.width)
    const mode = opts.mode ?? "average"

    const grid: string[][] = []
    for (let r = 0; r < height; r++) {
      const row: string[] = new Array(width).fill("")
      const y0 = Math.floor((r * srcHeight) / height)
      const y1 = Math.min(
        srcHeight,
        Math.max(y0 + 1, Math.floor(((r + 1) * srcHeight) / height)),
      )
      for (let c = 0; c < width; c++) {
        const x0 = Math.floor((c * srcWidth) / width)
        const x1 = Math.min(
          srcWidth,
          Math.max(x0 + 1, Math.floor(((c + 1) * srcWidth) / width)),
        )
        const rep = Transform.cellRepresentative(data, srcWidth, x0, y0, x1, y1, mode)
        if (!rep) continue
        row[c] = this.codes[this.nearestColorIndex(rep.r, rep.g, rep.b)]
      }
      grid.push(row)
    }

    const mergeSimilarity = opts.mergeSimilarity ?? 0
    if (mergeSimilarity > 0) {
      this.mergeSimilarColors(grid, mergeSimilarity)
    }
    if (opts.removeBackground) {
      this.removeBackgroundColor(grid)
    }

    return { grid, width, height, beadCount: countGridBeads(grid).size }
  }
}
