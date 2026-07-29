"use client"

import { useCallback, useEffect, useRef } from "react"
import { useEditorReducer } from "./use-editor-reducer"
import { useCanvasRenderer } from "./use-canvas-renderer"
import { useCanvasInteraction } from "./use-canvas-interaction"
import { useAutosave, loadDraft, clearDraft } from "./use-autosave"
import { PALETTES, DEFAULT_PALETTE_ID } from "@/lib/palette/registry"
import type { EditorState } from "@/types/editor"

/**
 * 编辑器顶层 hook：组合 reducer、渲染、交互、autosave，
 * 对外暴露组件所需的一切。
 */
export function useEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // ---- 尝试从 localStorage 恢复草稿 ----
  const draft = loadDraft()

  const { state, applyDiff, setColor, setTool, undo, redo, setZoom, setOffset, toggleGrid, toggleLabels, resize, load, clear } =
    useEditorReducer(draft?.width, draft?.height)

  // 加载草稿
  const draftLoaded = useRef(false)
  useEffect(() => {
    if (draft && !draftLoaded.current) {
      draftLoaded.current = true
      load(draft.cells, draft.width, draft.height, draft.paletteId ?? "mard")
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 当前色板 ----
  const palette = PALETTES.get(DEFAULT_PALETTE_ID) ?? PALETTES.values().next().value!

  // ---- 渲染 ----
  useCanvasRenderer(
    canvasRef,
    state.cells,
    state.width,
    state.height,
    state.zoom,
    state.offsetX,
    state.offsetY,
    state.showGridLines,
    state.showBeadNumbers,
    palette
  )

  // ---- autosave ----
  useAutosave(state)

  // ---- 交互 ----
  const getState = useCallback(() => state, [state])
  useCanvasInteraction(canvasRef, {
    applyDiff,
    setColor,
    setZoom,
    setOffset,
    getState,
  })

  // ---- 键盘快捷键 ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 不在输入框中时才响应
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault()
        undo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault()
        redo()
      }
      // 工具快捷键（无 modifier）
      if (!e.ctrlKey && !e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "b": setTool("pen"); break
          case "e": setTool("eraser"); break
          case "g": setTool("fill"); break
          case "l": setTool("line"); break
          case "r": setTool("rect"); break
          case "i": setTool("eyedropper"); break
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo, redo, setTool])

  return {
    canvasRef,
    state,
    palette,
    // actions
    applyDiff, setColor, setTool, undo, redo,
    setZoom, setOffset, toggleGrid, toggleLabels,
    resize, load, clear,
    // draft
    clearDraft,
  }
}
