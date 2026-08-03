"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Upload } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MAX_GRID_DIMENSION } from "@/lib/editor"
import { ErrorSchema } from "@/lib/validation"
import { useActivePalette } from "@/hooks/use-active-palette"
import type { TransformResult } from "@/lib/transform"
import type { BeadPalette } from "@/types/palette"

/** Maximum accepted upload size, mirroring the serverless body limit. */
const MAX_FILE_BYTES = 4 * 1024 * 1024
/** Preview canvas is drawn at most this many pixels per side. */
const PREVIEW_MAX = 320
/** Initial grid width in beads. */
const DEFAULT_WIDTH = 64
/** Debounce width edits before re-converting. */
const DEBOUNCE_MS = 300

interface ImportImageDialogProps {
  open: boolean
  onClose: () => void
  /** Called with the converted grid (`grid[row][col]`, 0 = empty) when the user applies. */
  onApply: (grid: number[][]) => void
}

/**
 * Draw a bead grid onto a canvas for preview.
 *
 * Grids larger than {@link PREVIEW_MAX} pixels per side are downsampled with a
 * per-bucket mode vote (the same dominant-colour idea as the editor's LOD).
 */
function drawGridToCanvas(
  canvas: HTMLCanvasElement,
  grid: number[][],
  palette: BeadPalette,
): void {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  if (rows === 0 || cols === 0) return

  const scale = Math.min(1, PREVIEW_MAX / Math.max(rows, cols))
  const pw = Math.max(1, Math.round(cols * scale))
  const ph = Math.max(1, Math.round(rows * scale))
  canvas.width = pw
  canvas.height = ph
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.clearRect(0, 0, pw, ph)

  if (scale >= 1) {
    for (let r = 0; r < rows; r++) {
      const row = grid[r]
      for (let c = 0; c < cols; c++) {
        const val = row[c]
        if (val <= 0) continue
        const color = palette.colors[val - 1]
        if (!color) continue
        ctx.fillStyle = color.hex
        ctx.fillRect(c, r, 1, 1)
      }
    }
    return
  }

  const freq = new Map<number, Map<number, number>>()
  for (let r = 0; r < rows; r++) {
    const row = grid[r]
    const py = Math.min(ph - 1, Math.floor(r * scale))
    for (let c = 0; c < cols; c++) {
      const val = row[c]
      if (val <= 0) continue
      const px = Math.min(pw - 1, Math.floor(c * scale))
      const key = py * pw + px
      let bucket = freq.get(key)
      if (!bucket) {
        bucket = new Map()
        freq.set(key, bucket)
      }
      bucket.set(val, (bucket.get(val) ?? 0) + 1)
    }
  }
  for (const [key, bucket] of freq) {
    let best = 0
    let bestN = 0
    for (const [val, n] of bucket) {
      if (n > bestN) {
        bestN = n
        best = val
      }
    }
    const color = palette.colors[best - 1]
    if (!color) continue
    ctx.fillStyle = color.hex
    ctx.fillRect(key % pw, Math.floor(key / pw), 1, 1)
  }
}

export function ImportImageDialog({ open, onClose, onApply }: ImportImageDialogProps) {
  const { brandId, palette } = useActivePalette()
  const [file, setFile] = useState<File | null>(null)
  const [widthInput, setWidthInput] = useState(String(DEFAULT_WIDTH))
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TransformResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reqId = useRef(0)

  const convert = useCallback(
    async (f: File, w: number) => {
      const id = ++reqId.current
      setConverting(true)
      setError(null)
      try {
        const formData = new FormData()
        formData.append("file", f)
        formData.append("width", String(w))
        formData.append("brandId", brandId)
        const res = await fetch("/api/image-to-grid", {
          method: "POST",
          body: formData,
        })
        if (id !== reqId.current) return
        const data: unknown = await res.json()
        if (!res.ok) {
          const parsed = ErrorSchema.safeParse(data)
          setResult(null)
          setError(parsed.success ? parsed.data.error : "Failed to convert image")
          return
        }
        setResult(data as TransformResult)
      } catch {
        if (id !== reqId.current) return
        setResult(null)
        setError("Network error. Please try again.")
      } finally {
        if (id === reqId.current) setConverting(false)
      }
    },
    [brandId],
  )

  // Convert when a file is chosen or the width changes (debounced).
  useEffect(() => {
    if (!file) return
    const w = Math.round(Number(widthInput))
    if (!Number.isFinite(w) || w <= 0) return
    const clamped = Math.min(MAX_GRID_DIMENSION, w)
    const t = setTimeout(() => {
      setConverting(true)
      void convert(file, clamped)
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [file, widthInput, convert])

  // Render the preview whenever a result arrives.
  useEffect(() => {
    if (!result || !canvasRef.current) return
    drawGridToCanvas(canvasRef.current, result.grid, palette)
  }, [result, palette])

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      setError("Please choose an image file.")
      return
    }
    if (f.size > MAX_FILE_BYTES) {
      setError("File must be 4MB or smaller.")
      return
    }
    setError(null)
    setResult(null)
    setFile(f)
  }, [])

  const handleClose = useCallback(() => {
    reqId.current++
    setFile(null)
    setWidthInput(String(DEFAULT_WIDTH))
    setConverting(false)
    setError(null)
    setResult(null)
    onClose()
  }, [onClose])

  const handleApply = useCallback(() => {
    if (!result) return
    onApply(result.grid)
    handleClose()
  }, [result, onApply, handleClose])

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from Image</DialogTitle>
          <DialogDescription>
            Convert an image into a bead pattern using the {palette.brand} palette.
          </DialogDescription>
        </DialogHeader>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click()
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const f = e.dataTransfer.files?.[0]
            if (f) handleFile(f)
          }}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Upload data-icon="inline-start" className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {file ? file.name : "Drag & drop an image, or click to browse"}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ""
            }}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="import-width">Width (beads)</Label>
          <Input
            id="import-width"
            type="number"
            min={1}
            max={MAX_GRID_DIMENSION}
            value={widthInput}
            onChange={(e) => setWidthInput(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Height is scaled proportionally.
          </p>
        </div>

        {converting && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
            Processing…
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {result && !converting && (
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-lg border bg-muted/30 p-2">
              <canvas
                ref={canvasRef}
                className="max-h-[320px] max-w-[320px]"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {result.width} × {result.height} · {result.beadCount.toLocaleString()} beads
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!result || converting}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
