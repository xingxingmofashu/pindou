"use client"

import { useSyncExternalStore } from "react"
import { PALETTES, DEFAULT_PALETTE_ID } from "@/lib/palette/registry"
import { getActivePaletteId, setActivePaletteId, subscribePalette } from "@/lib/palette/active"
import type { BeadPalette } from "@/types/palette"

interface ActivePalette {
  /** Id of the active brand, e.g. `"mard"`. */
  brandId: string
  /** The active palette, or `undefined` if the registry is empty. */
  palette: BeadPalette | undefined
  /** Switch the active brand by id; unknown ids are ignored. */
  setBrandId: (id: string) => void
}

/**
 * React binding for the shared active-brand store.
 *
 * Both ColorPalette (brand switcher) and usePixiCanvas (bead rendering)
 * subscribe to the same store, so a brand switch re-renders the canvas
 * without any prop wiring through the user-controlled EditorPage.
 *
 * @returns The current palette, its id, and a setter.
 */
export function useActivePalette(): ActivePalette {
  const brandId = useSyncExternalStore(
    subscribePalette,
    getActivePaletteId,
    () => DEFAULT_PALETTE_ID
  )
  const palette = PALETTES.get(brandId) ?? PALETTES.get(DEFAULT_PALETTE_ID)
  return { brandId, palette, setBrandId: setActivePaletteId }
}
