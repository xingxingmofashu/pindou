import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * SWR default fetcher: JSON GET that throws on non-OK responses so SWR records
 * the failure in its `error` state instead of returning the error body.
 */
export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return (await res.json()) as T
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
