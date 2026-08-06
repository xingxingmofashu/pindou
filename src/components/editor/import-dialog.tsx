"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import useSWRMutation from "swr/mutation"
import { Upload } from "lucide-react"
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
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { MAX_GRID_DIMENSION } from "@/lib/editor"
import { postJson } from "@/lib/utils"
import { usePalette } from "@/hooks/use-palette"
import { useI18n } from "@/i18n/client"
import type { TransformResult } from "@/lib/image/transform"
import type { Palette } from "@/types"

/** Maximum accepted upload size, mirroring the serverless body limit. */
const MAX_FILE_BYTES = 4 * 1024 * 1024
/** Preview canvas is drawn at most this many pixels per side. */
const PREVIEW_MAX = 320
/** Initial grid width in beads. */
const DEFAULT_WIDTH = 64
/** Debounce width edits before re-converting. */
const DEBOUNCE_MS = 300

interface ImportDialogProps {
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
  palette: Palette,
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

export function ImportDialog({ open, onClose, onApply }: ImportDialogProps) {
  const { palette } = usePalette()
  const { t } = useI18n()
  const [file, setFile] = useState<File | null>(null)
  const [widthInput, setWidthInput] = useState(String(DEFAULT_WIDTH))
  const [result, setResult] = useState<TransformResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reqId = useRef(0)
  const { trigger, isMutating } = useSWRMutation(
    "/api/transform",
    (url, { arg }: { arg: FormData }) =>
      postJson<TransformResult>(url, arg, t("editor.conversionFailed")),
  )

  // Convert when a file is chosen or the width changes (debounced). Each
  // trigger bumps `reqId` so a stale response from an earlier width edit is
  // dropped instead of overwriting a newer result.
  useEffect(() => {
    if (!file || !palette) return
    const w = Math.round(Number(widthInput))
    if (!Number.isFinite(w) || w <= 0) return
    const clamped = Math.min(MAX_GRID_DIMENSION, w)
    const timeout = setTimeout(() => {
      const id = ++reqId.current
      const formData = new FormData()
      formData.append("file", file)
      formData.append("width", String(clamped))
      formData.append("brandCode", palette.code)
      trigger(formData)
        .then((converted) => {
          if (id !== reqId.current) return
          setResult(converted)
        })
        .catch((e) => {
          if (id !== reqId.current) return
          setResult(null)
          toast.add({
            id: "import-conversion-failed",
            type: "error",
            title: t("editor.conversionFailed"),
            description: e instanceof Error ? e.message : t("editor.networkError"),
          })
        })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [file, widthInput, palette, trigger, t])

  // Render the preview whenever a result arrives.
  useEffect(() => {
    if (!result || !palette || !canvasRef.current) return
    drawGridToCanvas(canvasRef.current, result.grid, palette)
  }, [result, palette])

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      toast.add({
        type: "error",
        title: t("editor.unsupportedFile"),
        description: t("editor.unsupportedFileDescription"),
      })
      return
    }
    if (f.size > MAX_FILE_BYTES) {
      toast.add({
        type: "error",
        title: t("editor.fileTooLarge"),
        description: t("editor.fileTooLargeDescription"),
      })
      return
    }
    setResult(null)
    setFile(f)
  }, [t])

  const handleClose = useCallback(() => {
    reqId.current++
    setFile(null)
    setWidthInput(String(DEFAULT_WIDTH))
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
          <DialogTitle>{t("editor.importTitle")}</DialogTitle>
          <DialogDescription>
            {palette
              ? t("editor.importDescription", { name: palette.name })
              : t("editor.importDescriptionNoPalette")}
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
            {file ? file.name : t("editor.dropHint")}
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
          <Label htmlFor="import-width">{t("editor.width")}</Label>
          <Input
            id="import-width"
            type="number"
            min={1}
            max={MAX_GRID_DIMENSION}
            value={widthInput}
            onChange={(e) => setWidthInput(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t("editor.heightScaled")}
          </p>
        </div>

        {isMutating && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Spinner className="size-3.5" />
            {t("editor.processing")}
          </p>
        )}

        {result && !isMutating && (
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-lg border bg-muted/30 p-2">
              <canvas
                ref={canvasRef}
                className="max-h-[320px] max-w-[320px]"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("editor.resultSize", {
                width: result.width,
                height: result.height,
                count: result.beadCount.toLocaleString(),
              })}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleApply} disabled={!result || isMutating}>
            {t("editor.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
