/** JSON parsing helpers. */
export class Json {
  /**
   * Parse a JSON string, falling back to a default when it is missing or
   * malformed.
   *
   * The type parameter is a promise, not a guarantee — the fallback is
   * returned only on parse failure; callers still validate the shape.
   *
   * @param raw      - The JSON string to parse.
   * @param fallback - Value returned when parsing fails.
   * @returns The parsed value, or `fallback`.
   */
  static parse<T>(raw: string, fallback: T): T {
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }
}
