"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import { Application, Container, Graphics } from "pixi.js"
import { toast } from "@/components/ui/toast"
import type { PixiContext } from "@/lib/editor"

/**
 * Owns a PixiJS {@link Application} (and the "world" scene graph) inside a
 * React effect. The {@link Application.init} is awaited inside a
 * `requestAnimationFrame`, and the cleanup runs **synchronously on
 * unmount** — `app.destroy(true)` releases the WebGL context immediately so
 * navigating between routes does not leak contexts (browsers cap GL contexts,
 * and a leaked/lost one surfaces as a "failed" canvas).
 */
export function usePixiApp(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  backgroundColor: string,
): PixiContext | null {
  const [ctx, setCtx] = useState<PixiContext | null>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    const app = new Application()
    let cancelled = false

    const onContextLost = (e: Event) => {
      e.preventDefault()
      setCtx(null)
      toast.add({
        id: "webgl-context-lost",
        type: "error",
        title: "Canvas unavailable",
        description: "The WebGL canvas was lost. Please reload the page.",
      })
    }
    canvas.addEventListener("webglcontextlost", onContextLost)

    rafRef.current = requestAnimationFrame(async () => {
      try {
        await app.init({
          canvas,
          resizeTo: parent,
          background: backgroundColor,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        })
      } catch {
        toast.add({
          id: "webgl-unavailable",
          type: "error",
          title: "Canvas unavailable",
          description: "Your browser could not start the WebGL canvas. Please try a different browser.",
        })
        return /* WebGL unavailable */
      }
      if (cancelled) {
        app.destroy(true, { children: true })
        return
      }

      const world = new Container()
      world.label = "world"
      const beadsGfx = new Graphics()
      beadsGfx.label = "beads"
      const gridGfx = new Graphics()
      gridGfx.label = "grid"
      const labels = new Container()
      labels.label = "labels"

      world.addChild(beadsGfx)
      world.addChild(gridGfx)
      world.addChild(labels)
      app.stage.addChild(world)

      setCtx({ app, world, beadsGfx, gridGfx, labels })
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      canvas.removeEventListener("webglcontextlost", onContextLost)
      // Destroy the renderer AND release the WebGL context (`true`), and
      // recurse into the stage children. Synchronous, so nothing leaks the
      // GL context between routes.
      if (app.renderer) app.destroy(true, { children: true })
      setCtx(null)
    }
  }, [canvasRef, backgroundColor])

  return ctx
}