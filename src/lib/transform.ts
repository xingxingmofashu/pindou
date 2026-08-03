import sharp from "sharp"
import { converter, differenceCiede2000 } from "culori"
import { MAX_GRID_DIMENSION } from "@/lib/editor"
import { parseHex } from "@/lib/utils"
import type { BeadPalette } from "@/types/palette"

/** Pixels with alpha below this are treated as empty cells. */
const ALPHA_THRESHOLD = 128
/** OKLab-euclidean shortlist size before CIEDE2000 refinement. */
const OKLAB_TOP_K = 8
/** Source long side is never pre-scaled beyond this. */
const MAX_SOURCE_SIDE = 2048
/** Source is scaled at least to this long side for stable per-cell voting. */
const MIN_SOURCE_SIDE = 256
/** Pre-scale keeps roughly this many sub-samples per target cell. */
const SAMPLES_PER_CELL = 4

const toOklab = converter("oklab")
const toLab = converter("lab")

export interface TransformOptions {
  /** Target width in beads. */
  width: number
  /** Palette to quantize against; grid values are 1-based indices into `colors`. */
  palette: BeadPalette
}

export interface TransformResult {
  /** grid[row][col], 0 = empty, 1..N = palette index + 1. */
  grid: number[][]
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

function buildPaletteSamples(palette: BeadPalette): PaletteSamples {
  const ok: [number, number, number][] = []
  const lab: LabColor[] = []
  for (const c of palette.colors) {
    const [r, g, b] = parseHex(c.hex)
    const rgbColor = { mode: "rgb" as const, r: r / 255, g: g / 255, b: b / 255 }
    const o = toOklab(rgbColor)
    lab.push(toLab(rgbColor))
    ok.push([o.l, o.a, o.b])
  }
  return { ok, lab }
}

/**
 * Map an RGB pixel to the closest palette color index (0-based).
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

/**
 * Convert an image buffer into a bead grid quantized to a palette.
 *
 * Each target cell's color is the mode (dominant colour) of its source-pixel
 * region after per-pixel palette matching — never an averaged blend, which
 * would synthesize colours absent from the source. Very large sources are
 * pre-scaled with a smooth kernel (cost cap) while keeping >= SAMPLES_PER_CELL
 * sub-samples per cell so the mode stays stable.
 *
 * @param image - Encoded image bytes (PNG/JPEG/WebP/GIF/AVIF/TIFF).
 * @param opts - Target width in beads and the palette to match against.
 * @returns The dense grid plus dimensions and bead count.
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

  const targetSide = Math.max(width, height)
  const cap = Math.min(
    MAX_SOURCE_SIDE,
    Math.max(MIN_SOURCE_SIDE, targetSide * SAMPLES_PER_CELL),
  )
  const pipeline = sharp(image)
  const preScaled =
    Math.max(srcW, srcH) > cap
      ? pipeline.resize({ width: cap, kernel: sharp.kernel.linear })
      : pipeline

  const { data, info } = await preScaled
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const srcWidth = info.width
  const srcHeight = info.height
  const samples = buildPaletteSamples(opts.palette)
  const ciede = differenceCiede2000()

  const grid: number[][] = []
  let beadCount = 0
  for (let r = 0; r < height; r++) {
    const row: number[] = new Array<number>(width).fill(0)
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
      const counts = new Map<number, number>()
      for (let sy = y0; sy < y1; sy++) {
        let i = (sy * srcWidth + x0) * 4
        for (let sx = x0; sx < x1; sx++, i += 4) {
          if (data[i + 3] < ALPHA_THRESHOLD) continue
          const idx = nearestColorIndex(data[i], data[i + 1], data[i + 2], samples, ciede)
          counts.set(idx, (counts.get(idx) ?? 0) + 1)
        }
      }
      if (counts.size > 0) {
        let bestIdx = -1
        let bestCount = -1
        for (const [idx, n] of counts) {
          if (n > bestCount) {
            bestCount = n
            bestIdx = idx
          }
        }
        row[c] = bestIdx + 1
        beadCount++
      }
    }
    grid.push(row)
  }

  return { grid, width, height, beadCount }
}
