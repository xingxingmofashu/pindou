import { MAX_GRID_DIMENSION } from "@/lib/editor"

/** localStorage key holding the editor's auto-saved draft. */
const DRAFT_KEY = "pindou-editor-draft"

/**
 * Upper bound on persisted grid cells (`rows * cols`). The dense code grid is
 * stored as JSON, so huge canvases would blow the ~5MB localStorage quota;
 * larger grids simply skip saving (the draft keeps its previous value).
 */
const MAX_DRAFT_CELLS = 200_000

/** An auto-saved editor draft. */
export interface EditorDraft {
  /** Wire-format version, matched against {@link Draft.VERSION} on read. */
  version: number
  /** The palette's brand code (e.g. "mard") the grid was drawn with. */
  brandCode: string
  /** The serialized code grid (`grid[row][col]`, "" = empty). */
  grid: string[][]
  /** ms epoch when the draft was last saved. */
  savedAt: number
}

/**
 * Persists the editor draft to localStorage.
 *
 * The grid is a brand-specific code grid, so the brand is stored alongside it
 * to restore the correct palette. Reads/writes never throw — unavailable
 * storage (private mode, quota) silently degrades to a no-op.
 */
export class Draft {
  /** Wire-format version; bump when the JSON shape changes. */
  static readonly VERSION = 1

  /** True when the grid fits the persisted-draft size budget. */
  private isSized(grid: string[][]): boolean {
    const rows = grid.length
    const cols = grid[0]?.length ?? 0
    return (
      rows > 0 &&
      cols > 0 &&
      rows <= MAX_GRID_DIMENSION &&
      cols <= MAX_GRID_DIMENSION &&
      rows * cols <= MAX_DRAFT_CELLS
    )
  }

  /**
   * Parse a stored draft value, returning null when it's missing, malformed,
   * or from a different format version.
   *
   * @param raw - The raw localStorage string.
   * @returns The validated draft, or null.
   */
  private parse(raw: string | null): EditorDraft | null {
    if (!raw) return null
    try {
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== "object" || parsed === null) return null
      const { version, brandCode, grid, savedAt } = parsed as Record<string, unknown>
      if (version !== Draft.VERSION) return null
      if (typeof brandCode !== "string" || typeof savedAt !== "number") return null
      if (!Array.isArray(grid)) return null
      if (!grid.every((row) => Array.isArray(row) && row.every((c) => typeof c === "string"))) {
        return null
      }
      const typed = grid as string[][]
      if (!this.isSized(typed)) return null
      return { version, brandCode, grid: typed, savedAt }
    } catch {
      return null
    }
  }

  /**
   * Read the auto-saved editor draft from localStorage.
   *
   * @returns The saved draft, or null when none exists, storage is
   *          unavailable, or the stored value is invalid.
   */
  read(): EditorDraft | null {
    if (typeof window === "undefined") return null
    try {
      return this.parse(window.localStorage.getItem(DRAFT_KEY))
    } catch {
      return null
    }
  }

  /**
   * Persist the editor draft to localStorage. Grids larger than
   * {@link MAX_DRAFT_CELLS} are skipped so storage never overflows.
   *
   * @param draft - The draft to persist.
   */
  write(draft: EditorDraft): void {
    if (typeof window === "undefined") return
    if (!this.isSized(draft.grid)) return
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // Quota exceeded / private mode — the draft stays in memory only.
    }
  }

  /** Remove the auto-saved editor draft from localStorage. */
  remove(): void {
    if (typeof window === "undefined") return
    try {
      window.localStorage.removeItem(DRAFT_KEY)
    } catch {
      // Ignore storage failures.
    }
  }
}
