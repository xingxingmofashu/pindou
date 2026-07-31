"use client"

import { useEffect, useState } from "react"
import { Container, Graphics, type Application } from "pixi.js"
import type { PixiContext } from "@/hooks/use-pixi-canvas"

/**
 * Creates the PixiJS scene graph (world container, beads and grid graphics,
 * labels container) inside {@link useApplication}'s app.
 */
export function usePixiScene(app: Application, isInitialised: boolean): PixiContext | null {
  const [ctx, setCtx] = useState<PixiContext | null>(null)

  useEffect(() => {
    if (!isInitialised) return

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

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCtx({ app, world, beadsGfx, gridGfx, labels })

    return () => {
      if (!app.stage) return
      app.stage.removeChild(world)
      app.stage.removeChild(labels)
      world.destroy({ children: true })
      labels.destroy({ children: true })
      setCtx(null)
    }
  }, [isInitialised, app])

  return ctx
}
