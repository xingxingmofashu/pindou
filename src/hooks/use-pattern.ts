"use client"

import { create } from "zustand"
import { DEFAULT_ZOOM } from "@/lib/constants"
import type { PixiCanvasApi } from "@/components/pixi-canvas"

interface PatternStore {
  /** Imperative canvas API, registered by the pattern page on mount. */
  api: PixiCanvasApi | null
  /** Current zoom factor (screen pixels per world unit). */
  zoom: number
  /** Whether the info panel is shown. */
  showInfoPanel: boolean
  /** Whether the bead-usage panel is shown. */
  showBeadStats: boolean
  setApi: (api: PixiCanvasApi | null) => void
  setZoom: (zoom: number) => void
  toggleInfoPanel: () => void
  toggleBeadStats: () => void
}

/**
 * Shared state for the read-only pattern page. The canvas registers its
 * imperative API here (via `setApi`), and the top-bar zoom controls read the
 * api + zoom from the same store — letting the page compose its layout directly
 * without a wrapper that owns both.
 */
export const usePatternStore = create<PatternStore>((set) => ({
  api: null,
  zoom: DEFAULT_ZOOM,
  showInfoPanel: true,
  showBeadStats: true,
  setApi: (api) => set({ api }),
  setZoom: (zoom) => set({ zoom }),
  toggleInfoPanel: () => set((state) => ({ showInfoPanel: !state.showInfoPanel })),
  toggleBeadStats: () => set((state) => ({ showBeadStats: !state.showBeadStats })),
}))
