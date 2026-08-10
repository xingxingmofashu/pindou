"use client"

import { useCallback, useEffect, useRef, type RefObject } from "react"
import { create } from "zustand"
import useSWR from "swr"
import { Draft, type EditorDraft } from "@/lib/draft"
import { usePalette } from "@/hooks/use-palette"
import { fetcher } from "@/lib/utils"
import { toast } from "@/components/ui/toast"
import { useI18n } from "@/i18n/client"
import type { PixiCanvasApi } from "@/components/editor/pixi-canvas"
import type { Palette } from "@/types"

/** Shared draft state; persisted to localStorage by the actions below. */
interface DraftStore {
  draft: EditorDraft | null
  persistDraft: (draft: EditorDraft) => void
  onClearDraft: () => void
}

/** localStorage persistence for the editor draft. */
const draftStorage = new Draft()

const useDraftStore = create<DraftStore>((set) => ({
  draft: null,
  persistDraft: (draft) => {
    draftStorage.write(draft)
    set({ draft })
  },
  onClearDraft: () => {
    draftStorage.remove()
    set({ draft: null })
  },
}))

/** The canvas cells payload (grid + brand), as exposed by the canvas api. */
type CellsData = NonNullable<ReturnType<PixiCanvasApi["getCellsData"]>>

/** Restore lifecycle: no draft yet, waiting on the brand catalog, or finished. */
type RestoreState = "idle" | "pending" | "done"

/**
 * Auto-save the editor canvas to localStorage and restore it on mount.
 *
 * The draft is written on every grid change (stroke end, fill, import, …) and
 * on page unload, so it survives full reloads — including the GitHub OAuth
 * round-trip triggered when an anonymous user clicks publish. On mount the
 * saved draft is loaded back into the canvas once the palette resolves; if the
 * draft's brand differs from the active one, the brand is switched first so the
 * code grid deserializes against the correct palette.
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
  const { t } = useI18n()
  const { palette, setActivePalette } = usePalette()
  const { data: brands } = useSWR<Array<Palette>>("/api/brands", fetcher)
  const restoreStateRef = useRef<RestoreState>("idle")
  // True after a clear (publish / clear-canvas / brand-missing) until the next
  // real grid change, so the pagehide flush can't re-save the stale canvas.
  const suppressFlushRef = useRef(false)

  // Hydrate once per tab lifetime; the module re-creates on reload, so this
  // re-runs exactly when a fresh localStorage read is wanted.
  useEffect(() => {
    if (typeof window === "undefined") return
    const draft = draftStorage.read()
    if (draft) useDraftStore.setState({ draft })
  }, [])

  const draft = useDraftStore((s) => s.draft)
  const persistDraft = useDraftStore((s) => s.persistDraft)
  const clearDraft = useDraftStore((s) => s.onClearDraft)

  /**
   * Persist the canvas cells as a draft. Null (empty canvas) is a no-op; saves
   * are also suppressed while a restore is pending so drawing during the brand
   * lookup can't clobber the draft we're about to restore.
   */
  const onSaveDraft = useCallback(
    (cells: CellsData | null) => {
      if (!cells || restoreStateRef.current === "pending") return
      suppressFlushRef.current = false
      persistDraft({
        version: Draft.VERSION,
        brandCode: cells.brandCode,
        grid: cells.grid,
        savedAt: Date.now(),
      })
    },
    [persistDraft],
  )

  /** Clear the draft and keep the unload flush quiet until the next draw. */
  const handleClearDraft = useCallback(() => {
    suppressFlushRef.current = true
    clearDraft()
  }, [clearDraft])

  /** Backstop: flush the canvas to storage on page hide/unload. */
  useEffect(() => {
    const flush = () => {
      if (suppressFlushRef.current) return
      onSaveDraft(apiRef.current?.getCellsData() ?? null)
    }
    window.addEventListener("pagehide", flush)
    window.addEventListener("beforeunload", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      window.removeEventListener("beforeunload", flush)
    }
  }, [apiRef, onSaveDraft])

  /** Restore the saved draft once the palette (and its brand catalog) resolve. */
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
        handleClearDraft()
        toast.add({
          type: "error",
          title: t("editor.draftBrandMissing"),
          description: t("editor.draftBrandMissingDescription"),
        })
        return
      }
      setActivePalette(brand)
      return
    }

    restoreStateRef.current = "done"
    apiRef.current.loadGrid(draft.grid)
    toast.add({
      type: "success",
      title: t("editor.draftRestored"),
      description: t("editor.draftRestoredDescription"),
    })
  }, [draft, palette, brands, apiRef, setActivePalette, handleClearDraft, t])

  return { onSaveDraft, onClearDraft: handleClearDraft }
}
