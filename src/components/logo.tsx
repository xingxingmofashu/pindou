/**
 * Pixel font for A–Z (5×7 grid). `true` = filled cell.
 */
import { formatHex, interpolate } from "culori"

const GLYPHS: Record<string, boolean[][]> = {
  P: [
    [true, true, true, false],
    [true, false, true, false],
    [true, false, true, false],
    [true, true, true, false],
    [true, false, false, false],
    [true, false, false, false],
    [true, false, false, false],
  ],
  I: [
    [true, true, true],
    [false, true, false],
    [false, true, false],
    [false, true, false],
    [false, true, false],
    [false, true, false],
    [true, true, true],
  ],
  N: [
    [true, false, false, true],
    [true, true, false, true],
    [true, false, true, true],
    [true, false, true, true],
    [true, false, false, true],
    [true, false, false, true],
    [true, false, false, true],
  ],
  D: [
    [true, true, true, false],
    [true, false, false, true],
    [true, false, false, true],
    [true, false, false, true],
    [true, false, false, true],
    [true, false, false, true],
    [true, true, true, false],
  ],
  O: [
    [false, true, true, true, false],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [false, true, true, true, false],
  ],
  W: [
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, false, true, false, true],
    [true, true, false, true, true],
    [true, false, false, false, true],
  ],
}

const CHAR_W = { P: 4, I: 3, N: 4, D: 4, O: 5, W: 5 } as Record<string, number>
const CELL = 10
const GAP = 1

/** Interpolate between two hex colors. */
function lerpColor(a: string, b: string, t: number): string {
  return formatHex(interpolate([a, b])(t))
}

export function Logo({ className }: { className?: string }) {
  const word = ["P", "I", "N", "D", "O", "W"]

  // build a flat list of all columns across all letters to compute the gradient
  let totalCols = 0
  const offsets: number[] = []
  for (const ch of word) {
    offsets.push(totalCols)
    totalCols += CHAR_W[ch] + GAP
  }
  totalCols -= GAP // no trailing gap

  return (
    <svg
      viewBox={`0 0 ${totalCols * CELL} ${7 * CELL}`}
      preserveAspectRatio="none"
      className={className}
      aria-label="PINDOW"
      role="img"
    >
      {word.map((ch, li) => {
        const glyph = GLYPHS[ch]
        const ox = offsets[li] * CELL
        return glyph.map((row, r) =>
          row.map(
            (filled, c) =>
              filled && (
                <rect
                  key={`${li}-${r}-${c}`}
                  x={(ox + c * CELL)}
                  y={r * CELL}
                  width={CELL}
                  height={CELL}
                  rx={0.5}
                  fill={lerpColor("#1a1a1a", "#b0b0b0", (offsets[li] + c) / (totalCols - 1))}
                />
              )
          )
        )
      })}
    </svg>
  )
}
