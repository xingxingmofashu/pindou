/// <reference lib="webworker" />

import { Transform } from "@pindou/core/transform"
import type { TransformMode, TransformResult } from "@pindou/core/transform"
import { MAX_INPUT_PIXELS } from "@pindou/core/constants"
import type { Palette } from "@pindou/core/types"

/** A request to convert an image file into a bead grid. */
export interface TransformRequest {
  id: number
  file: File
  width: number
  mode: TransformMode
  mergeSimilarity: number
  removeBackground: boolean
  excludedCodes: string[]
  palette: Palette
}

/** Success or failure, tagged with the originating request id. */
export type TransformResponse =
  | { id: number; ok: true; result: TransformResult }
  | { id: number; ok: false; error: string }

const ctx = self as unknown as DedicatedWorkerGlobalScope

ctx.onmessage = async (event: MessageEvent<TransformRequest>) => {
  const { id, file, width, mode, mergeSimilarity, removeBackground, excludedCodes, palette } =
    event.data
  try {
    const result = await transform(file, width, mode, mergeSimilarity, removeBackground, excludedCodes, palette)
    const response: TransformResponse = { id, ok: true, result }
    ctx.postMessage(response)
  } catch (error) {
    const response: TransformResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : "Failed to convert image",
    }
    ctx.postMessage(response)
  }
}

async function transform(
  file: File,
  requestedWidth: number,
  mode: TransformMode,
  mergeSimilarity: number,
  removeBackground: boolean,
  excludedCodes: string[],
  palette: Palette,
): Promise<TransformResult> {
  const excluded = new Set(excludedCodes)
  const colors = palette.colors.filter((c) => !excluded.has(c.code))
  if (colors.length === 0) {
    throw new Error("No colours left to convert")
  }
  const activePalette: Palette = { ...palette, colors }

  const bitmap = await createImageBitmap(file)
  const srcW = bitmap.width
  const srcH = bitmap.height
  if (srcW <= 0 || srcH <= 0) {
    bitmap.close()
    throw new Error("Unsupported image")
  }
  if (srcW * srcH > MAX_INPUT_PIXELS) {
    bitmap.close()
    throw new Error(`Image is too large — max ${MAX_INPUT_PIXELS} pixels`)
  }

  const { width, height } = Transform.resolveGridSize(srcW, srcH, requestedWidth)
  const cap = Transform.resolvePrescaleCap(width, height)

  // Pre-scale the source so each target cell covers roughly SAMPLES_PER_CELL²
  // pixels and the long side never exceeds `cap`. `imageSmoothingEnabled`
  // selects the resampling kernel: linear for `average` (photos), nearest for
  // `dominant` (illustrations).
  const longSide = Math.max(srcW, srcH)
  const scale = longSide > cap ? cap / longSide : 1
  const capW = Math.max(1, Math.round(srcW * scale))
  const capH = Math.max(1, Math.round(srcH * scale))

  const canvas = new OffscreenCanvas(capW, capH)
  const context = canvas.getContext("2d")
  if (!context) {
    bitmap.close()
    throw new Error("Failed to read image")
  }
  context.imageSmoothingEnabled = mode === "average"
  context.drawImage(bitmap, 0, 0, capW, capH)
  bitmap.close()

  const { data } = context.getImageData(0, 0, capW, capH)

  return new Transform(activePalette).quantize(data, capW, capH, {
    width,
    mode,
    mergeSimilarity,
    removeBackground,
  })
}
