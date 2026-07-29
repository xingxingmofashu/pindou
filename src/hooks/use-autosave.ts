"use client"

import type { EditorState } from "@/types/editor"
import { useDebounce } from "./use-debounce"

const DRAFT_KEY = "pindou-editor-draft"

export interface DraftData {
  width: number
  height: number
  cells: Array<string | null>
  paletteId: string
  savedAt: number
}

export function loadDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as DraftData
    if (
      typeof draft.width === "number" &&
      typeof draft.height === "number" &&
      Array.isArray(draft.cells) &&
      draft.width * draft.height === draft.cells.length
    ) {
      return draft
    }
    return null
  } catch {
    return null
  }
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY)
}

/**
 * 监听 editor state 变化，自动防抖写入 localStorage。debouce 1.5s。
 */
export function useAutosave(state: EditorState): void {
  useDebounce(
    () => {
      const draft: DraftData = {
        width: state.width,
        height: state.height,
        cells: state.cells,
        paletteId: state.paletteId,
        savedAt: Date.now(),
      }
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      } catch {
        // quota exceeded or disabled
      }
    },
    1500,
    [state.cells, state.width, state.height, state.paletteId]
  )
}
