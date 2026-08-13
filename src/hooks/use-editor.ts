"use client"

import { create } from "zustand"
import { DEFAULT_ZOOM } from "@/lib/constants"
import type { ToolKind, BeadStats } from "@/lib/editor"
import type { PixiCanvasApi } from "@/components/pixi-canvas"

interface EditorStore {
  /** Imperative canvas API, registered by the editor canvas on mount. */
  api: PixiCanvasApi | null
  /** Currently active drawing tool. */
  activeTool: ToolKind
  /** Currently selected palette colour (0 = eraser, 1..N = palette index). */
  activeColorIndex: number
  /** Whether colour-code labels are shown on the canvas. */
  showLabels: boolean
  /** Whether the bead-usage panel is shown. */
  showBeadStats: boolean
  /** Whether the colour palette panel is shown. */
  showColorPalette: boolean
  /** Live per-colour bead counts (null while the grid is empty). */
  beadStats: BeadStats | null
  /** Current zoom factor (screen pixels per world unit). */
  zoom: number
  /** Whether the user can undo the last canvas edit. */
  canUndo: boolean
  /** Whether the user can redo a previously undone canvas edit. */
  canRedo: boolean
  /** Publish / import / export dialog visibility. */
  publishOpen: boolean
  importOpen: boolean
  exportOpen: boolean
  setApi: (api: PixiCanvasApi | null) => void
  setActiveTool: (tool: ToolKind | ((prev: ToolKind) => ToolKind)) => void
  setActiveColorIndex: (index: number) => void
  toggleLabels: () => void
  toggleBeadStats: () => void
  toggleColorPalette: () => void
  setBeadStats: (stats: BeadStats | null) => void
  setZoom: (zoom: number) => void
  setHistory: (canUndo: boolean, canRedo: boolean) => void
  openPublish: () => void
  closePublish: () => void
  openImport: () => void
  closeImport: () => void
  openExport: () => void
  closeExport: () => void
}

/**
 * Shared state for the editor page. The canvas registers its imperative API
 * here (via `setApi`), and the toolbar, side panels, and dialogs read/write the
 * same store — letting the editor page compose its layout without lifting every
 * cross-cutting piece of state into a single parent component.
 */
export const useEditorStore = create<EditorStore>((set) => ({
  api: null,
  activeTool: "pen",
  activeColorIndex: 1,
  showLabels: false,
  showBeadStats: true,
  showColorPalette: true,
  beadStats: null,
  zoom: DEFAULT_ZOOM,
  canUndo: false,
  canRedo: false,
  publishOpen: false,
  importOpen: false,
  exportOpen: false,
  setApi: (api) => set({ api }),
  setActiveTool: (tool) =>
    set((state) => ({ activeTool: typeof tool === "function" ? tool(state.activeTool) : tool })),
  setActiveColorIndex: (index) => set({ activeColorIndex: index }),
  toggleLabels: () => set((state) => ({ showLabels: !state.showLabels })),
  toggleBeadStats: () => set((state) => ({ showBeadStats: !state.showBeadStats })),
  toggleColorPalette: () => set((state) => ({ showColorPalette: !state.showColorPalette })),
  setBeadStats: (stats) => set({ beadStats: stats }),
  setZoom: (zoom) => set({ zoom }),
  setHistory: (canUndo, canRedo) => set({ canUndo, canRedo }),
  openPublish: () => set({ publishOpen: true }),
  closePublish: () => set({ publishOpen: false }),
  openImport: () => set({ importOpen: true }),
  closeImport: () => set({ importOpen: false }),
  openExport: () => set({ exportOpen: true }),
  closeExport: () => set({ exportOpen: false }),
}))
