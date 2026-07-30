import { Application, Container, Graphics } from "pixi.js"

/** PixiJS objects owned by a single {@link createPixiApp} call. */
export interface PixiContext {
  app: Application
  world: Container
  beadsGfx: Graphics
  gridGfx: Graphics
  labels: Container
}

/** Create and initialise a PixiJS Application bound to the given canvas. */
export async function createPixiApp(
  canvas: HTMLCanvasElement,
  backgroundColor: string,
): Promise<PixiContext> {
  const parent = canvas.parentElement
  if (!parent) throw new Error("Canvas has no parent element")

  const app = new Application()
  await app.init({
    canvas,
    resizeTo: parent,
    background: backgroundColor,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })

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

  return { app, world, beadsGfx, gridGfx, labels }
}
