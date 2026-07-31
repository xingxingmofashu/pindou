import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Parse a hex colour string into its R, G, B components. */
export function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

export function hexToRgb(hex: string): number {
  return parseInt(hex.replace("#", ""), 16)
}

export function totalBeadCount(stats: Record<string, number>): number {
  let sum = 0
  for (const v of Object.values(stats)) sum += v
  return sum
}

export function parseBeadStats(raw: string): Record<string, number> {
  try {
    return JSON.parse(raw) as Record<string, number>
  } catch {
    return {}
  }
}
