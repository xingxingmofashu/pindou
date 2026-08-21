"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import { Application, Container, Graphics } from "pixi.js"
import type { PixiContext } from "../editor"

/** Failure kinds the host app can surface (e.g. via a toast). */
export type PixiAppError = "context-lost" | "webgl-unavailable"

interface UsePixiAppOptions {
  /**
   * Called when the WebGL context is lost or unavailable. The host app owns
   * error presentation (core stays UI-framework-agnostic).
   */
  onError?: (kind: PixiAppError) => void
}

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
  options: UsePixiAppOptions = {},
): PixiContext | null {
  const [ctx, setCtx] = useState<PixiContext | null>(null)
  const rafRef = useRef(0)
  const onErrorRef = useRef(options.onError)
  useEffect(() => {
    onErrorRef.current = options.onError
  }, [options.onError])

  // Latest background behind a ref for the same reason: `app.init` must use
  // the theme-aware colour of the first render, but a later theme change
  // (which changes the prop) must NOT re-run the init effect and rebuild the
  // WebGL context — runtime recolouring is handled by usePixiCanvas.
  const backgroundRef = useRef(backgroundColor)
  useEffect(() => {
    backgroundRef.current = backgroundColor
  }, [backgroundColor])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    const app = new Application()
    let cancelled = false
    let resizeObserver: ResizeObserver | undefined

    const onContextLost = (e: Event) => {
      e.preventDefault()
      setCtx(null)
      onErrorRef.current?.("context-lost")
    }
    canvas.addEventListener("webglcontextlost", onContextLost)

    rafRef.current = requestAnimationFrame(async () => {
      try {
        await app.init({
          canvas,
          resizeTo: parent,
          background: backgroundRef.current,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        })
      } catch {
        onErrorRef.current?.("webgl-unavailable")
        return /* WebGL unavailable */
      }
      if (cancelled) {
        app.destroy(true, { children: true })
        return
      }

      // Pixi's own ResizePlugin only reacts to window resizes, so a container
      // that reflows without a window change (e.g. the editor's sidebar panels
      // toggling) leaves the canvas oversized. Watch the parent and resize it
      // to its content box whenever its layout box changes.
      resizeObserver = new ResizeObserver(() => {
        const { clientWidth, clientHeight } = parent
        if (clientWidth > 0 && clientHeight > 0) {
          app.renderer.resize(clientWidth, clientHeight)
        }
      })
      resizeObserver.observe(parent)

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
      resizeObserver?.disconnect()
      canvas.removeEventListener("webglcontextlost", onContextLost)
      // Destroy the renderer AND release the WebGL context (`true`), and
      // recurse into the stage children. Synchronous, so nothing leaks the
      // GL context between routes.
      if (app.renderer) app.destroy(true, { children: true })
      setCtx(null)
    }
  }, [canvasRef])

  return ctx
}