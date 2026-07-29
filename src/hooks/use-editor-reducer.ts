"use client"

import { useReducer, useCallback } from "react"
import type { EditorAction, EditorActionEntry, EditorState } from "@/types/editor"
import { GRID_DEFAULT, MAX_UNDO } from "@/lib/constants"
import { computeBeadStats } from "@/lib/editor/stats"

function applyEntry(cells: Array<string | null>, entry: EditorActionEntry): void {
  const { indices, after } = entry
  for (let i = 0; i < indices.length; i++) {
    cells[indices[i]] = after[i]
  }
}

function updateStats(
  stats: Map<string, number>,
  indices: number[],
  before: Array<string | null>,
  after: Array<string | null>
): void {
  for (let i = 0; i < indices.length; i++) {
    const b = before[i]
    const a = after[i]
    if (b !== null) {
      const c = stats.get(b)! - 1
      if (c <= 0) stats.delete(b)
      else stats.set(b, c)
    }
    if (a !== null) {
      stats.set(a, (stats.get(a) ?? 0) + 1)
    }
  }
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_TOOL":
      return { ...state, activeTool: action.tool }
    case "SET_COLOR":
      return { ...state, activeColorId: action.colorId }
    case "APPLY_DIFF": {
      const cells = [...state.cells]
      const stats = new Map(state.beadStats)
      applyEntry(cells, action.diff)
      updateStats(stats, action.diff.indices, action.diff.before, action.diff.after)
      const undo = [...state.undoStack, action.diff]
      if (undo.length > MAX_UNDO) undo.shift()
      return { ...state, cells, beadStats: stats, undoStack: undo, redoStack: [] }
    }
    case "UNDO": {
      if (state.undoStack.length === 0) return state
      const entry = state.undoStack[state.undoStack.length - 1]
      const cells = [...state.cells]
      const stats = new Map(state.beadStats)
      // UNDO: apply entry.before, reverse stats
      const { indices, before, after } = entry
      for (let i = 0; i < indices.length; i++) cells[indices[i]] = before[i]
      updateStats(stats, indices, after, before)
      return {
        ...state, cells, beadStats: stats,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, entry],
      }
    }
    case "REDO": {
      if (state.redoStack.length === 0) return state
      const entry = state.redoStack[state.redoStack.length - 1]
      const cells = [...state.cells]
      const stats = new Map(state.beadStats)
      const { indices, before, after } = entry
      for (let i = 0; i < indices.length; i++) cells[indices[i]] = after[i]
      updateStats(stats, indices, before, after)
      return {
        ...state, cells, beadStats: stats,
        undoStack: [...state.undoStack, entry],
        redoStack: state.redoStack.slice(0, -1),
      }
    }
    case "SET_ZOOM":
      return { ...state, zoom: Math.max(0.5, Math.min(64, action.zoom)) }
    case "SET_OFFSET":
      return { ...state, offsetX: action.offsetX, offsetY: action.offsetY }
    case "TOGGLE_GRID_LINES":
      return { ...state, showGridLines: !state.showGridLines }
    case "TOGGLE_BEAD_NUMBERS":
      return { ...state, showBeadNumbers: !state.showBeadNumbers }
    case "RESIZE": {
      const { width, height } = action
      const cells = new Array(width * height).fill(null)
      const copyW = Math.min(state.width, width)
      const copyH = Math.min(state.height, height)
      for (let y = 0; y < copyH; y++)
        for (let x = 0; x < copyW; x++)
          cells[y * width + x] = state.cells[y * state.width + x]
      return {
        ...state, width, height, cells,
        beadStats: computeBeadStats(cells),
        undoStack: [], redoStack: [],
      }
    }
    case "LOAD":
      return {
        ...createEditorState(action.width, action.height),
        cells: action.cells,
        paletteId: action.paletteId,
        beadStats: computeBeadStats(action.cells),
      }
    case "CLEAR": {
      const cells = new Array(state.width * state.height).fill(null)
      return { ...state, cells, beadStats: new Map(), undoStack: [], redoStack: [] }
    }
    default:
      return state
  }
}

export function createEditorState(width = GRID_DEFAULT, height = GRID_DEFAULT): EditorState {
  return {
    width, height,
    cells: new Array(width * height).fill(null),
    paletteId: "mard",
    activeTool: "pen",
    activeColorId: null,
    zoom: 8, offsetX: 0, offsetY: 0,
    showGridLines: true, showBeadNumbers: false,
    beadStats: new Map(),
    undoStack: [], redoStack: [],
  }
}

export function useEditorReducer(width = GRID_DEFAULT, height = GRID_DEFAULT) {
  const [state, dispatch] = useReducer(reducer, createEditorState(width, height))

  const applyDiff = useCallback(
    (diff: EditorActionEntry) => dispatch({ type: "APPLY_DIFF", diff }),
    [dispatch]
  )
  const setTool = useCallback((t: EditorState["activeTool"]) => dispatch({ type: "SET_TOOL", tool: t }), [dispatch])
  const setColor = useCallback((id: string) => dispatch({ type: "SET_COLOR", colorId: id }), [dispatch])
  const undo = useCallback(() => dispatch({ type: "UNDO" }), [dispatch])
  const redo = useCallback(() => dispatch({ type: "REDO" }), [dispatch])
  const setZoom = useCallback((z: number) => dispatch({ type: "SET_ZOOM", zoom: z }), [dispatch])
  const setOffset = useCallback((x: number, y: number) => dispatch({ type: "SET_OFFSET", offsetX: x, offsetY: y }), [dispatch])
  const toggleGrid = useCallback(() => dispatch({ type: "TOGGLE_GRID_LINES" }), [dispatch])
  const toggleLabels = useCallback(() => dispatch({ type: "TOGGLE_BEAD_NUMBERS" }), [dispatch])
  const resize = useCallback((w: number, h: number) => dispatch({ type: "RESIZE", width: w, height: h }), [dispatch])
  const load = useCallback(
    (cells: Array<string | null>, w: number, h: number, paletteId: string) =>
      dispatch({ type: "LOAD", cells, width: w, height: h, paletteId }),
    [dispatch]
  )
  const clear = useCallback(() => dispatch({ type: "CLEAR" }), [dispatch])

  return {
    state,
    dispatch,
    // convenience
    applyDiff, setTool, setColor, undo, redo, setZoom, setOffset,
    toggleGrid, toggleLabels, resize, load, clear,
  }
}
