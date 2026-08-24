/**
 * Desktop domain types.
 *
 * The grid wire format matches the web app's contract: `string[][]` where
 * `grid[row][col]` is `""` (empty) or a colour code like `"A1"` — the same
 * shape `@pindou/core`'s `deserializeGrid`/`serializeGrid` consume and
 * produce, so pattern data is portable between the web and desktop apps.
 */

/**
 * A pattern's metadata row (as stored in SQLite).
 *
 * Mirrors the web app's `patterns` table (apps/web/src/db/schema.ts) so the
 * two stores stay interchangeable; `fk_brand_id` holds the brand's uuid from
 * the bundled palette catalog (same ids the web DB uses). Desktop-only
 * differences: `grid` is stored on the filesystem, and there is no auth, so
 * `fk_user_id`/`author_name` are absent.
 */
export interface PatternMeta {
  id: string
  title: string
  description: string
  /** Brand uuid (matches the web DB's brands.id via the bundled catalog). */
  fkBrandId: string
  /** Relative path under the patterns dir; the absolute path is resolved in main. */
  gridKey: string
  /** Serialized bead stats (JSON string), same wire format as the web. */
  beadStats: string
  /** Public thumbnail URL/path; empty string when none (like the web default). */
  thumbUrl: string
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
  /** Brand uuid (from the bundled catalog). */
  fkBrandId: string
  beadStats?: string
  grid: string[][]
}

/** Payload to update an existing pattern. */
export interface UpdatePatternInput {
  title?: string
  description?: string
  fkBrandId?: string
  beadStats?: string
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
    /** Read a pattern's thumbnail as a data URL, or null when missing. */
    thumbnail: (id: string) => Promise<string | null>
  }
  saveDialog: (options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>
  /** Show the system save dialog and write a PNG file. Resolves the written
   *  path, or null when the user cancels. */
  savePng: (data: Uint8Array, defaultName: string) => Promise<string | null>
}
