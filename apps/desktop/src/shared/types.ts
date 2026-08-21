/**
 * Desktop domain types.
 *
 * The grid wire format matches the web app's contract: `string[][]` where
 * `grid[row][col]` is `""` (empty) or a colour code like `"A1"` — the same
 * shape `@pindou/core`'s `deserializeGrid`/`serializeGrid` consume and
 * produce, so pattern data is portable between the web and desktop apps.
 */

/** A pattern's metadata row (as stored in SQLite). */
export interface PatternMeta {
  id: string
  title: string
  description: string
  brandCode: string
  /** Relative path under the patterns dir; the absolute path is resolved in main. */
  gridKey: string
  /** Relative path to the thumbnail PNG under the patterns dir, if any. */
  thumbPath: string | null
  createdAt: string
  updatedAt: string
}

/** Full pattern: metadata + the code grid loaded from disk. */
export interface PatternRecord extends PatternMeta {
  grid: string[][]
}

/** Payload to create a new pattern. */
export interface CreatePatternInput {
  title?: string
  description?: string
  brandCode: string
  grid: string[][]
}

/** Payload to update an existing pattern. */
export interface UpdatePatternInput {
  title?: string
  description?: string
  brandCode?: string
  grid?: string[][]
}

/** The API surface exposed on `window.pindou` by the preload script. */
export interface PindouApi {
  patterns: {
    list: () => Promise<PatternMeta[]>
    get: (id: string) => Promise<PatternRecord | null>
    create: (input: CreatePatternInput) => Promise<PatternMeta>
    update: (id: string, input: UpdatePatternInput) => Promise<PatternMeta>
    remove: (id: string) => Promise<void>
  }
  saveDialog: (options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>
}
