export type DrawTool = "pen" | "eraser" | "fill" | "line" | "rect" | "eyedropper"

/** 编辑器状态 */
export interface EditorState {
  width: number
  height: number
  /** 每个格子的色号 id（来自 beadColor.id），空 = null */
  cells: Array<string | null>
  paletteId: string
  activeTool: DrawTool
  activeColorId: string | null
  zoom: number
  offsetX: number
  offsetY: number
  showGridLines: boolean
  showBeadNumbers: boolean
  /** colorId → count，绘制时增量更新 */
  beadStats: Map<string, number>
  undoStack: EditorActionEntry[]
  redoStack: EditorActionEntry[]
}

export interface EditorActionEntry {
  /** 本次操作改动的格子索引集合（y * width + x） */
  indices: number[]
  /** 操作前的值 */
  before: Array<string | null>
  /** 操作后的值 */
  after: Array<string | null>
}

export type EditorAction =
  | { type: "SET_TOOL"; tool: DrawTool }
  | { type: "SET_COLOR"; colorId: string }
  | { type: "APPLY_DIFF"; diff: EditorActionEntry }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SET_OFFSET"; offsetX: number; offsetY: number }
  | { type: "TOGGLE_GRID_LINES" }
  | { type: "TOGGLE_BEAD_NUMBERS" }
  | { type: "RESIZE"; width: number; height: number }
  | { type: "LOAD"; cells: Array<string | null>; width: number; height: number; paletteId: string }
  | { type: "CLEAR" }

export interface EditorRef {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** 屏幕坐标 → 网格坐标变换 */
  screenToGrid: (sx: number, sy: number) => { x: number; y: number } | null
  /** 网格坐标 → 屏幕坐标 */
  gridToScreen: (gx: number, gy: number) => { x: number; y: number }
  /** 当前可视区域内可见的行列范围 */
  visibleRange: () => { colStart: number; colEnd: number; rowStart: number; rowEnd: number }
}
