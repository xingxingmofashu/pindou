"use client"

import { useCallback, useEffect, useRef, type RefObject } from "react"
import { create } from "zustand"
import useSWR from "swr"
import { usePalette } from "@/hooks/use-palette"
import { fetcher } from "@/lib/utils"
import type { PixiCanvasApi } from "@/components/editor/pixi-canvas"
import type { Palette } from "@/types"

/**
 * An in-memory editor draft. The grid is a brand-specific code grid
 * (`grid[row][col]` = `""` empty or a colour code like `"A1"`), so the brand
 * is stored alongside it to restore the correct palette.
 */
interface EditorDraft {
  /** The palette's brand code (e.g. "mard") the grid was drawn with. */
  brandCode: string
  /** The serialized code grid. */
  grid: string[][]
}

/** Shared draft state, held in memory only (no localStorage). */
interface DraftStore {
  draft: EditorDraft | null
  onSaveDraft: (draft: EditorDraft) => void
  onClearDraft: () => void
}

const useDraftStore = create<DraftStore>((set) => ({
  draft: null,
  onSaveDraft: (draft) => set({ draft }),
  onClearDraft: () => set({ draft: null }),
}))

/** The canvas cells payload (grid + brand), as exposed by the canvas api. */
type CellsData = NonNullable<ReturnType<PixiCanvasApi["getCellsData"]>>

/** Restore lifecycle: no draft yet, waiting on the brand catalog, or finished. */
type RestoreState = "idle" | "pending" | "done"

/**
 * Hold the editor draft in memory across client-side navigation.
 *
 * The draft is written on every grid change (stroke end, fill, import, …) into
 * a module-level store, so it survives SPA route changes (editor → patterns →
 * editor) within the same page session. It is intentionally NOT persisted —
 * a full reload (including the GitHub OAuth round-trip on publish) starts with
 * a blank canvas. On mount the store's draft is loaded back into the canvas
 * once the palette resolves; if the draft's brand differs from the active one,
 * the brand is switched first so the code grid deserializes correctly.
 *
 * An empty canvas never clears the draft here: brand switches fire a canvas
 * reset (which surfaces as a null grid) right before the restore, so clearing
 * on null would erase the very draft we're about to restore. The draft is
 * instead cleared explicitly on publish and on the clear-canvas action.
 *
 * @param apiRef - Ref to the editor canvas api (grid load/serialize).
 * @returns A stable save callback and the draft's clear action.
 */
export function useDraft(apiRef: RefObject<PixiCanvasApi | null>) {
  const { palette, setActivePalette } = usePalette()
  const { data: brands } = useSWR<Array<Palette>>("/api/brands", fetcher)
  const restoreStateRef = useRef<RestoreState>("idle")

  const draft = useDraftStore((s) => s.draft)
  const onSaveDraft = useDraftStore((s) => s.onSaveDraft)
  const onClearDraft = useDraftStore((s) => s.onClearDraft)

  /**
   * Persist the canvas cells as a draft. Null (empty canvas) is a no-op; saves
   * are also suppressed while a restore is pending so drawing during the brand
   * lookup can't clobber the draft we're about to restore.
   */
  const saveDraft = useCallback(
    (cells: CellsData | null) => {
      if (!cells || restoreStateRef.current === "pending") return
      onSaveDraft({ brandCode: cells.brandCode, grid: cells.grid })
    },
    [onSaveDraft],
  )

  /** Restore the store's draft once the palette (and its brand catalog) resolve. */
  useEffect(() => {
    if (restoreStateRef.current === "done") return
    if (!draft || !palette || !apiRef.current) return

    restoreStateRef.current = "pending"

    if (palette.code !== draft.brandCode) {
      // The draft was drawn with a different brand — switch to it before
      // restoring so codes deserialize against the right palette. The palette
      // change clears the canvas (resetModel) and re-runs this effect.
      if (!brands) return
      const brand = brands.find((b) => b.code === draft.brandCode)
      if (!brand) {
        // The brand no longer exists — the draft can't be mapped, so discard.
        restoreStateRef.current = "done"
        onClearDraft()
        return
      }
      setActivePalette(brand)
      return
    }

    restoreStateRef.current = "done"
    apiRef.current.loadGrid(draft.grid)
  }, [draft, palette, brands, apiRef, setActivePalette, onClearDraft])

  return { onSaveDraft: saveDraft, onClearDraft }
}
