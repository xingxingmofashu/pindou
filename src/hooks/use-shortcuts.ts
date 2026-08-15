"use client"

import { useEffect } from "react"
import type { ToolKind } from "@/lib/editor"

/** Keyboard shortcut matching each tool, mirroring the ToolBar tooltips. */
const TOOL_SHORTCUTS: Record<string, ToolKind> = {
  b: "pen",
  e: "eraser",
  g: "fill",
  i: "eyedropper",
}

/** Whether the event target is a text field (input, textarea, contenteditable). */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable
}

/**
 * Global tool-switching shortcuts (B/E/G/I) advertised in the ToolBar tooltips.
 * Ignored while typing in a text field (dialogs) or when a modifier is held
 * (Cmd/Ctrl+Z, Cmd/Ctrl+Y, …).
 */
export function useShortcuts(onSelectTool: (tool: ToolKind) => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      const tool = TOOL_SHORTCUTS[e.key.toLowerCase()]
      if (tool) {
        e.preventDefault()
        onSelectTool(tool)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onSelectTool])
}
