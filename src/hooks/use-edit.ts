"use client"

import { create } from "zustand"
import { DEFAULT_ZOOM } from "@/lib/constants"
import type { BeadStats } from "@/lib/editor"
import type { PixiCanvasApi } from "@/components/pixi-canvas"

interface EditStore {
  /** Imperative canvas API, registered by the edit form on mount. */
  api: PixiCanvasApi | null
  /** Pattern title (draft, edited in the left panel). */
  title: string
  /** Pattern description (draft, edited in the left panel). */
  description: string
  /** Currently selected palette colour (0 = eraser, 1..N = palette index). */
  activeColorIndex: number
  /** Whether colour-code labels are shown on the canvas. */
  showLabels: boolean
  /** Whether the left (fields + palette) panel is shown. */
  showLeftPanel: boolean
  /** Whether the bead-usage panel is shown. */
  showBeadStats: boolean
  /** Current zoom factor (screen pixels per world unit). */
  zoom: number
  /** Live per-colour bead counts (null while the grid is empty). */
  beadStats: BeadStats | null
  /** Whether the export dialog is open. */
  exportOpen: boolean
  /** Whether a save request is in flight. */
  saving: boolean
  setApi: (api: PixiCanvasApi | null) => void
  /** Reset per-instance state and seed the draft fields from the pattern. */
  reset: (title: string, description: string) => void
  setTitle: (title: string) => void
  setDescription: (description: string) => void
  setActiveColorIndex: (index: number) => void
  toggleLabels: () => void
  toggleLeftPanel: () => void
  toggleBeadStats: () => void
  setZoom: (zoom: number) => void
  setBeadStats: (stats: BeadStats | null) => void
  openExport: () => void
  closeExport: () => void
  setSaving: (saving: boolean) => void
}

/**
 * Shared state for the pattern-edit page. The canvas registers its imperative
 * API here (via `setApi`), and the toolbar, panels, and export dialog read/write
 * the same store — so the edit form composes its layout without lifting every
 * cross-cutting piece of state into a single parent component.
 */
export const useEditStore = create<EditStore>((set) => ({
  api: null,
  title: "",
  description: "",
  activeColorIndex: 1,
  showLabels: false,
  showLeftPanel: true,
  showBeadStats: true,
  zoom: DEFAULT_ZOOM,
  beadStats: null,
  exportOpen: false,
  saving: false,
  setApi: (api) => set({ api }),
  reset: (title, description) =>
    set({
      title,
      description,
      activeColorIndex: 1,
      showLabels: false,
      showLeftPanel: true,
      showBeadStats: true,
      zoom: DEFAULT_ZOOM,
      beadStats: null,
      exportOpen: false,
      saving: false,
    }),
  setTitle: (title) => set({ title }),
  setDescription: (description) => set({ description }),
  setActiveColorIndex: (index) => set({ activeColorIndex: index }),
  toggleLabels: () => set((state) => ({ showLabels: !state.showLabels })),
  toggleLeftPanel: () => set((state) => ({ showLeftPanel: !state.showLeftPanel })),
  toggleBeadStats: () => set((state) => ({ showBeadStats: !state.showBeadStats })),
  setZoom: (zoom) => set({ zoom }),
  setBeadStats: (stats) => set({ beadStats: stats }),
  openExport: () => set({ exportOpen: true }),
  closeExport: () => set({ exportOpen: false }),
  setSaving: (saving) => set({ saving }),
}))
