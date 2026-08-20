export * from "@pindou/shared/utils"

/**
 * Escape `\`, `%` and `_` for use inside a SQL `LIKE` pattern so user input is
 * matched literally rather than as wildcards. Postgres uses backslash as the
 * default escape character, so each special char becomes a backslash-pair.
 *
 * Postgres-specific — kept in the web app (not `@pindou/shared`), where the
 * SQL dialect is fixed.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}
