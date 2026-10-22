import type { Grid } from "./grid"

/**
 * The editor's undo/redo stacks, extracted from `use-pixi-canvas` so the
 * semantics can be reasoned about (and tested) without React.
 *
 * A snapshot is a whole {@link Grid}; entries are pushed *before* a destructive
 * operation and compared by content, so no-op strokes never create an undo
 * step.
 */
export class GridHistory {
  private undoStack: Grid[] = []
  private redoStack: Grid[] = []

  /**
   * @param limit - Maximum number of undo entries kept (oldest dropped first).
   */
  constructor(private readonly limit = 50) {}

  /** Whether {@link undo} has an entry to restore. */
  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  /** Whether {@link redo} has an entry to restore. */
  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /**
   * Record the state before a change.
   *
   * Snapshots equal to the current state are dropped (no-op op), and any
   * successful push invalidates the redo stack.
   *
   * @param before  - Snapshot taken before the operation.
   * @param current - The grid as it is now.
   * @returns `true` when a snapshot was recorded, `false` for a no-op.
   */
  push(before: Grid, current: Grid): boolean {
    if (before.equals(current)) return false
    this.undoStack.push(before)
    if (this.undoStack.length > this.limit) this.undoStack.shift()
    this.redoStack = []
    return true
  }

  /**
   * Pop the previous snapshot.
   *
   * @param current - The grid to put on the redo stack.
   * @returns The snapshot to restore, or `null` when the stack is empty.
   */
  undo(current: Grid): Grid | null {
    const prev = this.undoStack.pop()
    if (!prev) return null
    this.redoStack.push(current)
    return prev
  }

  /**
   * Pop the next snapshot.
   *
   * @param current - The grid to put back on the undo stack.
   * @returns The snapshot to restore, or `null` when the stack is empty.
   */
  redo(current: Grid): Grid | null {
    const next = this.redoStack.pop()
    if (!next) return null
    this.undoStack.push(current)
    if (this.undoStack.length > this.limit) this.undoStack.shift()
    return next
  }

  /** Drop both stacks (used on brand switch, where indices change meaning). */
  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
}
