// Re-exported shared utilities (defined in @pindou/core so both web and the
// desktop app share the same implementations).
export { cn, fetcher, postJson, hexToRgb, safeParseJson, isTypingTarget, totalBeadCount, parseBeadStats } from "@pindou/core"

/**
 * Escape `\`, `%` and `_` for use inside a SQL `LIKE` pattern so user input is
 * matched literally rather than as wildcards. Postgres uses backslash as the
 * default escape character, so each special char becomes a backslash-pair.
 *
 * Postgres-specific — kept in the web app, not @pindou/core.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}
