"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import { Application, Container, Graphics } from "pixi.js"

/** PixiJS objects owned by a single {@link usePixiApp} call. */
export interface PixiContext {
  app: Application
  world: Container
  beadsGfx: Graphics
  gridGfx: Graphics
  labels: Container
}

export function usePixiApp(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  backgroundColor: string,
): PixiContext | null {
  const [ctx, setCtx] = useState<PixiContext | null>(null)
  const rafRef = useRef(0)
  const appRef = useRef<Application | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    let dead = false

    const safeDestroy = (app: Application) => {
      try { app.destroy(true) } catch { /* init may be incomplete */ }
    }

    const onContextLost = (e: Event) => {
      e.preventDefault()
      setCtx(null)
    }

    canvas.addEventListener("webglcontextlost", onContextLost)

    /** Defer init by one frame so flex layout has resolved parent dimensions. */
    rafRef.current = requestAnimationFrame(() => {
      if (dead) return

      const app = new Application()
      appRef.current = app

      app.init({
        canvas,
        resizeTo: parent,
        background: backgroundColor,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      }).then(() => {
        if (dead) { safeDestroy(app); return }

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
        app.stage.addChild(world)
        app.stage.addChild(labels)

        setCtx({ app, world, beadsGfx, gridGfx, labels })
      }).catch(() => {
        /* WebGL unavailable — canvas stays blank */
      })
    })

    return () => {
      dead = true
      cancelAnimationFrame(rafRef.current)
      canvas.removeEventListener("webglcontextlost", onContextLost)
      if (appRef.current) safeDestroy(appRef.current)
      setCtx(null)
    }
  }, [canvasRef, backgroundColor])

  return ctx
}
