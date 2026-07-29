"use client"

import { RefObject, useEffect, useRef } from "react"
import type { BeadPalette } from "@/types/palette"
import { LABEL_ZOOM_THRESHOLD } from "@/lib/constants"

/**
 * 监听 cells / palette / 视图状态变化，用 requestAnimationFrame 重绘 canvas。
 * 离屏缓存：1px/豆的 ImageData 位图，仅 cells 或 palette 变更时重建。
 */
export function useCanvasRenderer(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  cells: Array<string | null>,
  width: number,
  height: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
  showGridLines: boolean,
  showBeadNumbers: boolean,
  palette: BeadPalette | undefined
): void {
  const offscreenRef = useRef<OffscreenCanvas | null>(null)
  const frameRef = useRef<number>(0)

  // 色号 id → hex 的快速查表
  const hexMapRef = useRef<Map<string, string>>(new Map())

  // palette 变化时重构 hex map
  useEffect(() => {
    const map = new Map<string, string>()
    if (palette) {
      for (const c of palette.colors) map.set(c.id, c.hex)
    }
    hexMapRef.current = map
    offscreenRef.current = null // 强制重绘
  }, [palette])

  // cells / width 变化时重建离屏位图
  useEffect(() => {
    const offscreen = new OffscreenCanvas(width, height)
    const ctx = offscreen.getContext("2d")
    if (!ctx) return
    const imageData = ctx.createImageData(width, height)
    const data = imageData.data
    const hexMap = hexMapRef.current
    for (let i = 0; i < cells.length; i++) {
      const id = cells[i]
      const offset = i * 4
      if (id === null) {
        data[offset + 3] = 0 // transparent
        continue
      }
      const hex = hexMap.get(id)
      if (!hex) {
        data[offset + 3] = 0
        continue
      }
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      data[offset] = r
      data[offset + 1] = g
      data[offset + 2] = b
      data[offset + 3] = 255
    }
    ctx.putImageData(imageData, 0, 0)
    offscreenRef.current = offscreen
  }, [cells, width, height])

  // 每帧绘制
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = parent.clientWidth * dpr
    canvas.height = parent.clientHeight * dpr
    canvas.style.width = parent.clientWidth + "px"
    canvas.style.height = parent.clientHeight + "px"

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let running = true
    const render = () => {
      if (!running) return
      const offscreen = offscreenRef.current
      ctx.save()
      // 清除
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      // DPR + 视图变换
      ctx.scale(dpr, dpr)
      ctx.translate(offsetX, offsetY)
      // 豆子层：像素画，禁止平滑
      if (offscreen) {
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(offscreen, 0, 0, width * zoom, height * zoom)
      }
      // 网格线
      if (showGridLines) drawGrid(ctx, width, height, zoom)
      // 色号标签（高倍缩放时）
      if (showBeadNumbers && zoom >= LABEL_ZOOM_THRESHOLD) {
        drawLabels(ctx, cells, width, height, zoom)
      }
      ctx.restore()
      frameRef.current = requestAnimationFrame(render)
    }
    frameRef.current = requestAnimationFrame(render)

    return () => { running = false; cancelAnimationFrame(frameRef.current) }
  }, [canvasRef, cells, width, height, zoom, offsetX, offsetY, showGridLines, showBeadNumbers])
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  zoom: number
): void {
  const pxW = width * zoom
  const pxH = height * zoom
  ctx.strokeStyle = "rgba(0,0,0,0.15)"
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= width; x++) {
    ctx.moveTo(x * zoom, 0)
    ctx.lineTo(x * zoom, pxH)
  }
  for (let y = 0; y <= height; y++) {
    ctx.moveTo(0, y * zoom)
    ctx.lineTo(pxW, y * zoom)
  }
  ctx.stroke()
}

function drawLabels(
  ctx: CanvasRenderingContext2D,
  cells: Array<string | null>,
  width: number,
  height: number,
  zoom: number
): void {
  ctx.save()
  const fontSize = Math.max(3, Math.min(zoom * 0.6, 10))
  ctx.font = `${fontSize}px monospace`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const id = cells[y * width + x]
      if (id === null) continue
      // 只在色块足够大时画标签
      if (zoom < 8) break
      const cx = (x + 0.5) * zoom
      const cy = (y + 0.5) * zoom
      // 对比色：亮底用深字，暗底用浅字
      ctx.fillStyle = "rgba(0,0,0,0.6)"
      ctx.fillText(id.toUpperCase(), cx + 0.5, cy + 0.5)
      ctx.fillStyle = "rgba(255,255,255,0.6)"
      ctx.fillText(id.toUpperCase(), cx, cy)
    }
  }
  ctx.restore()
}
