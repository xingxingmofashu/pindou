import sharp from "sharp"
import { converter, differenceCiede2000 } from "culori"
import { MAX_GRID_DIMENSION } from "@/lib/editor"
import type { Palette } from "@/types"

/** Pixels with alpha below this are treated as empty cells. */
const ALPHA_THRESHOLD = 128
/** OKLab-euclidean shortlist size before CIEDE2000 refinement. */
const OKLAB_TOP_K = 8
/** Source long side is never pre-scaled beyond this. */
const MAX_SOURCE_SIDE = 2048
/** Source is scaled at least to this long side for stable per-cell averaging. */
const MIN_SOURCE_SIDE = 256
/** Pre-scale keeps roughly this many sub-samples per target cell. */
const SAMPLES_PER_CELL = 12

const toOklab = converter("oklab")
const toLab = converter("lab")

/** How a cell's source pixels collapse into one representative colour. */
export type TransformMode = "average" | "dominant"

export interface TransformOptions {
  /** Target width in beads. */
  width: number
  /** Palette to quantize against. */
  palette: Palette
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

type LabColor = NonNullable<ReturnType<typeof toLab>>

interface PaletteSamples {
  /** OKLab (l, a, b) per palette color, for the euclidean shortlist. */
  ok: [number, number, number][]
  /** CIELab per palette color, for the CIEDE2000 refinement. */
  lab: LabColor[]
}

function buildPaletteSamples(palette: Palette): PaletteSamples {
  const ok: [number, number, number][] = []
  const lab: LabColor[] = []
  for (const c of palette.colors) {
    // Palette hexes come from the DB (validated 6-digit values); culori's
    // string-input conversions type as `| undefined` but cannot fail here.
    const o = toOklab(c.hex)!
    lab.push(toLab(c.hex)!)
    ok.push([o.l, o.a, o.b])
  }
  return { ok, lab }
}

/**
 * Map an RGB colour to the closest palette color index (0-based).
 *
 * A cheap OKLab-euclidean pass picks the {@link OKLAB_TOP_K} closest colors,
 * then CIEDE2000 — the perceptually most accurate delta-E — breaks the tie.
 */
function nearestColorIndex(
  r: number,
  g: number,
  b: number,
  samples: PaletteSamples,
  ciede: ReturnType<typeof differenceCiede2000>,
): number {
  const rgbColor = { mode: "rgb" as const, r: r / 255, g: g / 255, b: b / 255 }
  const ok = toOklab(rgbColor)

  const best: { d: number; i: number }[] = []
  for (let i = 0; i < samples.ok.length; i++) {
    const [pl, pa, pb] = samples.ok[i]
    const dl = ok.l - pl
    const da = ok.a - pa
    const db = ok.b - pb
    const d = dl * dl + da * da + db * db
    if (best.length < OKLAB_TOP_K) {
      best.push({ d, i })
      if (best.length === OKLAB_TOP_K) best.sort((a, b) => a.d - b.d)
    } else if (d < best[best.length - 1].d) {
      best[best.length - 1] = { d, i }
      let j = best.length - 1
      while (j > 0 && best[j].d < best[j - 1].d) {
        const t = best[j]
        best[j] = best[j - 1]
        best[j - 1] = t
        j--
      }
    }
  }

  const cl = toLab(rgbColor)
  let winner = best[0]?.i ?? 0
  let winD = Infinity
  for (const { i } of best) {
    const d = ciede(cl, samples.lab[i])
    if (d < winD) {
      winD = d
      winner = i
    }
  }
  return winner
}

/** Euclidean distance between two OKLab triples. */
function oklabDistance(
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
 * @param palette   - Palette used to resolve code → OKLab.
 * @param threshold - Maximum OKLab distance between the merged pair.
 */
function mergeSimilarColours(
  grid: string[][],
  palette: Palette,
  threshold: number,
): void {
  const counts = new Map<string, number>()
  for (const row of grid) {
    for (const code of row) {
      if (code === "") continue
      counts.set(code, (counts.get(code) ?? 0) + 1)
    }
  }
  if (counts.size < 2) return

  const okByCode = new Map<string, [number, number, number]>()
  for (const color of palette.colors) {
    const o = toOklab(color.hex)!
    okByCode.set(color.code, [o.l, o.a, o.b])
  }

  const codes = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([code]) => code)

  const replacement = new Map<string, string>()
  for (let i = 0; i < codes.length; i++) {
    const high = codes[i]
    if (replacement.has(high)) continue
    const highOk = okByCode.get(high)
    if (!highOk) continue
    for (let j = i + 1; j < codes.length; j++) {
      const low = codes[j]
      if (replacement.has(low)) continue
      const lowOk = okByCode.get(low)
      if (!lowOk) continue
      if (oklabDistance(highOk, lowOk) < threshold) {
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
function removeBackgroundColour(grid: string[][]): void {
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

  let bg = ""
  let bgCount = 0
  for (const [code, n] of borderCounts) {
    if (n > bgCount) {
      bgCount = n
      bg = code
    }
  }
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

  while (stack.length > 0) {
    const idx = stack.pop()!
    const r = Math.floor(idx / w)
    const c = idx % w
    grid[r][c] = ""
    const neighbours: [number, number][] = [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]
    for (const [nr, nc] of neighbours) {
      if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue
      const nIdx = nr * w + nc
      if (visited[nIdx] || grid[nr][nc] !== bg) continue
      visited[nIdx] = 1
      stack.push(nIdx)
    }
  }
}

/**
 * Convert an image buffer into a bead grid quantized to a palette.
 *
 * Each target cell first collapses its source-pixel region into a single
 * representative colour — the RGB average for photos, or the most frequent
 * exact RGB for illustrations — and that representative is then mapped to the
 * nearest palette colour. Averaging before quantizing (rather than quantizing
 * each pixel and voting) keeps gradients smooth and free of scattered noise.
 * The source is pre-scaled so each cell covers roughly {@link SAMPLES_PER_CELL}²
 * pixels; `nearest` kernel preserves exact colours for `dominant` mode, while
 * `linear` gives the box-like average `average` mode wants.
 *
 * @param image - Encoded image bytes (PNG/JPEG/WebP/GIF/AVIF/TIFF).
 * @param opts  - Target width, palette, and optional mode / merge / background.
 * @returns The dense code grid plus dimensions and bead count.
 */
export async function transform(
  image: Buffer,
  opts: TransformOptions,
): Promise<TransformResult> {
  const metadata = await sharp(image).metadata()
  const srcW = metadata.width ?? 0
  const srcH = metadata.height ?? 0
  if (srcW <= 0 || srcH <= 0) throw new Error("Unsupported image")

  const width = Math.min(Math.max(1, Math.round(opts.width)), MAX_GRID_DIMENSION)
  const height = Math.min(
    Math.max(1, Math.round((width * srcH) / srcW)),
    MAX_GRID_DIMENSION,
  )

  const mode = opts.mode ?? "average"
  const targetSide = Math.max(width, height)
  const cap = Math.min(
    MAX_SOURCE_SIDE,
    Math.max(MIN_SOURCE_SIDE, targetSide * SAMPLES_PER_CELL),
  )
  const pipeline = sharp(image)
  const preScaled =
    Math.max(srcW, srcH) > cap
      ? pipeline.resize({
          width: cap,
          kernel: mode === "dominant" ? sharp.kernel.nearest : sharp.kernel.linear,
        })
      : pipeline

  const { data, info } = await preScaled
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const srcWidth = info.width
  const srcHeight = info.height
  const samples = buildPaletteSamples(opts.palette)
  const ciede = differenceCiede2000()

  const grid: string[][] = []
  let beadCount = 0
  for (let r = 0; r < height; r++) {
    const row: string[] = new Array<string>(width).fill("")
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

      let rSum = 0
      let gSum = 0
      let bSum = 0
      let pixelCount = 0
      let domKey = 0
      let domCount = 0
      const freq = new Map<number, number>()

      for (let sy = y0; sy < y1; sy++) {
        let i = (sy * srcWidth + x0) * 4
        for (let sx = x0; sx < x1; sx++, i += 4) {
          if (data[i + 3] < ALPHA_THRESHOLD) continue
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          if (mode === "average") {
            rSum += r
            gSum += g
            bSum += b
            pixelCount++
          } else {
            pixelCount++
            const key = (r << 16) | (g << 8) | b
            const n = (freq.get(key) ?? 0) + 1
            freq.set(key, n)
            if (n > domCount) {
              domCount = n
              domKey = key
            }
          }
        }
      }

      if (pixelCount === 0) continue

      let repR: number
      let repG: number
      let repB: number
      if (mode === "average") {
        repR = Math.round(rSum / pixelCount)
        repG = Math.round(gSum / pixelCount)
        repB = Math.round(bSum / pixelCount)
      } else {
        repR = (domKey >> 16) & 0xff
        repG = (domKey >> 8) & 0xff
        repB = domKey & 0xff
      }

      const idx = nearestColorIndex(repR, repG, repB, samples, ciede)
      row[c] = opts.palette.colors[idx].code
      beadCount++
    }
    grid.push(row)
  }

  if ((opts.mergeSimilarity ?? 0) > 0) {
    mergeSimilarColours(grid, opts.palette, opts.mergeSimilarity!)
  }
  if (opts.removeBackground) {
    removeBackgroundColour(grid)
    // Background removal may have emptied cells; recount.
    beadCount = 0
    for (const row of grid) {
      for (const code of row) {
        if (code !== "") beadCount++
      }
    }
  }

  return { grid, width, height, beadCount }
}
