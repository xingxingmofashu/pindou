"use client"

import { RefObject, useCallback, useEffect, useRef } from "react"
import type { EditorActionEntry, EditorState } from "@/types/editor"
import { bresenhamLine, floodFill, rect, eyedropper } from "@/lib/editor/tools"

interface InteractionHandlers {
  applyDiff: (diff: EditorActionEntry) => void
  setColor: (id: string) => void
  setZoom: (z: number) => void
  setOffset: (x: number, y: number) => void
  getState: () => EditorState
}

/**
 * 监听 canvas 的 pointer / wheel 事件，把交互转为工具调用与视图变换。
 * 用 ref 持有 transient 拖拽状态，避免每次 mousemove 触发 render。
 */
export function useCanvasInteraction(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  handlers: InteractionHandlers
): void {
  const { applyDiff, setColor, setZoom, setOffset, getState } = handlers

  // transient refs — 拖拽过程不入 state
  const isDrawing = useRef(false)
  const isPanning = useRef(false)
  const prevPoint = useRef<{ x: number; y: number } | null>(null)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const accumulated = useRef<Set<number>>(new Set())
  const panStart = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null)
  const lastPinchDist = useRef<number>(0)

  const stateRef = useRef(getState)
  stateRef.current = getState

  // ---- coordinate helpers ----
  const screenToGrid = useCallback(
    (sx: number, sy: number) => {
      const s = stateRef.current()
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return null
      const gx = Math.floor((sx - rect.left - s.offsetX) / s.zoom)
      const gy = Math.floor((sy - rect.top - s.offsetY) / s.zoom)
      if (gx < 0 || gx >= s.width || gy < 0 || gy >= s.height) return null
      return { x: gx, y: gy }
    },
    [canvasRef]
  )

  // pointer 坐标转 client 坐标
  const toClient = (e: React.PointerEvent<HTMLCanvasElement> | PointerEvent) => ({
    x: e.clientX,
    y: e.clientY,
  })

  // ---- pointer events ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId)
      const s = stateRef.current()
      const p = toClient(e)

      // 中键或 space 时平移
      if (e.button === 1) {
        isPanning.current = true
        panStart.current = { ox: s.offsetX, oy: s.offsetY, px: p.x, py: p.y }
        return
      }

      const grid = screenToGrid(p.x, p.y)
      if (!grid) return

      switch (s.activeTool) {
        case "pen":
        case "eraser": {
          isDrawing.current = true
          prevPoint.current = grid
          accumulated.current = new Set()
          const idx = grid.y * s.width + grid.x
          accumulated.current.add(idx)
          break
        }
        case "fill": {
          const fillTarget = s.activeColorId
          if (!fillTarget) return
          const startIdx = grid.y * s.width + grid.x
          if (s.cells[startIdx] === fillTarget) return // 同色无需填充
          const touched = floodFill(s.cells, s.width, s.height, grid.x, grid.y)
          const indices = [...touched]
          applyDiff({
            indices,
            before: indices.map((i) => s.cells[i]),
            after: indices.map(() => fillTarget),
          })
          break
        }
        case "eyedropper": {
          const id = eyedropper(s.cells, s.width, grid.x, grid.y)
          if (id) setColor(id)
          break
        }
        case "line":
        case "rect": {
          dragStart.current = grid
          break
        }
      }
    }

    const onMove = (e: PointerEvent) => {
      const p = toClient(e)

      if (isPanning.current && panStart.current) {
        const { ox, oy, px, py } = panStart.current
        setOffset(ox + p.x - px, oy + p.y - py)
        return
      }

      const grid = screenToGrid(p.x, p.y)

      if (isDrawing.current && grid) {
        const s = stateRef.current()
        const prev = prevPoint.current
        const targetId = s.activeTool === "eraser" ? null : s.activeColorId
        if (!targetId && s.activeTool !== "eraser") return

        const touched = prev
          ? bresenhamLine(prev.x, prev.y, grid.x, grid.y, s.width, s.height)
          : new Set<number>()
        prevPoint.current = grid
        for (const idx of touched) accumulated.current.add(idx)
      }
    }

    const onUp = (e: PointerEvent) => {
      isPanning.current = false
      panStart.current = null

      if (isDrawing.current) {
        isDrawing.current = false
        prevPoint.current = null
        const s = stateRef.current()
        const indices = [...accumulated.current]
        accumulated.current = new Set()
        const targetId = s.activeTool === "eraser" ? null : s.activeColorId
        if (!targetId && s.activeTool !== "eraser") return
        applyDiff({
          indices,
          before: indices.map((i) => s.cells[i]),
          after: indices.map(() => targetId),
        })
      }

      // line / rect finalize
      if (dragStart.current) {
        const p = toClient(e)
        const end = screenToGrid(p.x, p.y) ?? dragStart.current
        const s = stateRef.current()
        const targetId = s.activeColorId
        if (!targetId) { dragStart.current = null; return }
        const { x: x0, y: y0 } = dragStart.current
        dragStart.current = null
        let touched: Set<number>
        if (s.activeTool === "line") {
          touched = bresenhamLine(x0, y0, end.x, end.y, s.width, s.height)
        } else {
          touched = rect(x0, y0, end.x, end.y, s.width, s.height)
        }
        const indices = [...touched]
        applyDiff({
          indices,
          before: indices.map((i) => s.cells[i]),
          after: indices.map(() => targetId),
        })
      }
    }

    canvas.addEventListener("pointerdown", onDown)
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerup", onUp)
    // 避免浏览器默认手势干扰
    canvas.style.touchAction = "none"
    return () => {
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerup", onUp)
    }
  }, [canvasRef, applyDiff, setColor, setOffset, screenToGrid])

  // ---- wheel zoom ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = stateRef.current()
      const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2
      const newZoom = Math.max(0.5, Math.min(64, s.zoom * factor))
      // 以鼠标位置为中心缩放
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const ratio = newZoom / s.zoom
      setZoom(newZoom)
      setOffset(
        cx - ratio * (cx - s.offsetX),
        cy - ratio * (cy - s.offsetY)
      )
    }
    canvas.addEventListener("wheel", onWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", onWheel)
  }, [canvasRef, setZoom, setOffset])

  // ---- pinch zoom (touch) ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let initDist = 0
    let initZoom = 0
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[1].clientX - e.touches[0].clientX
        const dy = e.touches[1].clientY - e.touches[0].clientY
        initDist = Math.hypot(dx, dy)
        lastPinchDist.current = initDist
        initZoom = stateRef.current().zoom
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || initDist === 0) return
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      const dist = Math.hypot(dx, dy)
      if (Math.abs(dist - lastPinchDist.current) < 2) return
      lastPinchDist.current = dist
      const factor = dist / initDist
      setZoom(Math.max(0.5, Math.min(64, initZoom * factor)))
    }
    canvas.addEventListener("touchstart", onTouchStart, { passive: true })
    canvas.addEventListener("touchmove", onTouchMove, { passive: true })
    return () => {
      canvas.removeEventListener("touchstart", onTouchStart)
      canvas.removeEventListener("touchmove", onTouchMove)
    }
  }, [canvasRef, setZoom])
}
