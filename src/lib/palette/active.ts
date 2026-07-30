import { PALETTES, DEFAULT_PALETTE_ID } from "./registry"

/**
 * Module-level store for the active bead brand.
 *
 * EditorPage is user-controlled and cannot wire the selected brand from
 * ColorPalette to usePixiCanvas, so both sides share this external store
 * instead of props. Consumed by React via `useActivePalette`.
 */
let activeId = DEFAULT_PALETTE_ID
const listeners = new Set<() => void>()

/** Return the id of the currently active palette. */
export function getActivePaletteId(): string {
  return activeId
}

/**
 * Switch the active palette and notify subscribers.
 *
 * @param id - Palette identifier to switch to (must be registered in {@link PALETTES}).
 * Unknown ids and no-op switches are ignored.
 */
export function setActivePaletteId(id: string): void {
  if (!PALETTES.has(id) || id === activeId) return
  activeId = id
  for (const listener of listeners) listener()
}

/** Subscribe to palette switches.
 *
 * @param listener - Callback invoked on every palette change.
 * @returns An unsubscribe function.
 */
export function subscribePalette(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
