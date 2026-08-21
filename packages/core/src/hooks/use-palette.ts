"use client"

import { create } from "zustand"
import type { Palette } from "@pindou/shared/types"

interface PaletteStore {
  /** The active palette; undefined until ColorPalette seeds one. */
  palette: Palette | undefined
  /** Switch the active palette (built from the `/api/brands` catalog). */
  setActivePalette: (palette: Palette) => void
}

const usePaletteStore = create<PaletteStore>((set) => ({
  palette: undefined,
  setActivePalette: (palette) =>
    set((state) => (palette.code === state.palette?.code ? state : { palette })),
}))

/**
 * React binding for the shared palette state.
 *
 * Reads the active palette from a module-level Zustand store and makes no
 * network requests of its own. ColorPalette fetches `/api/brands` (brands with
 * colors nested) for its switcher, builds the chosen brand's palette, and
 * pushes it into the store. The editor canvas (`EditablePaletteBridge`) and
 * import dialog read the shared palette because the user-controlled EditorPage
 * cannot wire it as a prop. Consumers that need a *specific* brand (pattern
 * detail page, export dialog) fetch it directly in their own page code instead.
 * SSR snapshots keep hydration consistent.
 *
 * @returns The active palette and a setter.
 */
export function usePalette(): PaletteStore {
  const palette = usePaletteStore((s) => s.palette)
  const setActivePalette = usePaletteStore((s) => s.setActivePalette)
  return { palette, setActivePalette }
}
