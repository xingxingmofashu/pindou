import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function hexToRgb(hex: string): number {
  return parseInt(hex.replace("#", ""), 16)
}

/**
 * Parse a JSON string, falling back to a default when it is missing or
 * malformed. The type parameter is a promise, not a guarantee — the fallback
 * is returned only on parse failure, callers still validate the shape.
 *
 * @param raw      - The JSON string to parse.
 * @param fallback - Value returned when parsing fails.
 * @returns The parsed value, or `fallback`.
 */
export function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Whether the event target is a text field (input, textarea, contenteditable). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable
}

export function totalBeadCount(stats: Record<string, number>): number {
  let sum = 0
  for (const v of Object.values(stats)) sum += v
  return sum
}

export function parseBeadStats(raw: string): Record<string, number> {
  return safeParseJson(raw, {})
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

/**
 * POST (or PATCH) a JSON string or `FormData` body and parse the JSON response.
 *
 * Non-OK responses are unwrapped via the shared `{ error }` envelope and
 * thrown as `Error`s, so callers catch a single exception type. FormData
 * bodies are sent as-is (the browser sets `multipart/form-data`); string
 * bodies are sent as `application/json`.
 *
 * @param url          - The endpoint to call.
 * @param body         - A JSON string, or a FormData payload.
 * @param fallbackText - Error message used when the response body isn't a
 *                       valid `{ error }` envelope.
 * @param method       - HTTP method to use (defaults to `POST`).
 */
export async function postJson<T>(
  url: string,
  body: string | FormData,
  fallbackText = `Request failed`,
  method: "POST" | "PATCH" = "POST",
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: typeof body === "string" ? { "Content-Type": "application/json" } : undefined,
    body,
  })
  const data: unknown = await res.json()
  if (!res.ok) {
    const parsed = (data as { error?: unknown } | null)?.error
    throw new Error(typeof parsed === "string" ? parsed : fallbackText)
  }
  return data as T
}
