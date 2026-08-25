"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronRight, Search, Upload } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible"
import { Input } from "../ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { Label } from "../ui/label"
import { Switch } from "../ui/switch"
import { Spinner } from "../ui/spinner"
import { toast } from "../ui/toast"
import { MAX_FILE_BYTES, MAX_GRID_DIMENSION } from "@pindou/shared/constants"
import { buildHexByCode, gridSize, mostFrequent, groupColorsBySeries } from "@pindou/core/editor"
import { usePalette } from "@pindou/core/hooks/use-palette"
import { useI18n } from "@pindou/core/i18n/client"
import type { TransformMode, TransformRequest, TransformResponse, TransformResult } from "@pindou/core/transform"
import type { Palette } from "@pindou/shared/types"

/** Preview canvas is drawn at most this many pixels per side. */
const PREVIEW_MAX = 320
/** Initial grid width in beads. */
const DEFAULT_WIDTH = 128
/** Debounce width edits before re-converting. */
const DEBOUNCE_MS = 300

/** Default merge strength (OKLab distance) when the option is enabled. */
const DEFAULT_MERGE_SIMILARITY = 0.05

interface ImportDialogProps {
  open: boolean
  onClose: () => void
  /** Called with the converted code grid (`grid[row][col]`, "" = empty) when the user applies. */
  onApply: (grid: string[][]) => void
  /** Pinned palette (pattern editor). Falls back to the active-brand store. */
  palette?: Palette
  /**
   * Creates the conversion Web Worker — injected by the app because the worker
   * URL is bundle-specific (`new Worker(new URL("...", import.meta.url))`).
   * Return `null` when workers are unavailable.
   */
  createWorker: () => Worker | null
}

/**
 * Draw a bead grid onto a canvas for preview.
 *
 * Grids larger than {@link PREVIEW_MAX} pixels per side are downsampled with a
 * per-bucket mode vote (the same dominant-colour idea as the editor's LOD).
 */
function drawGridToCanvas(
  canvas: HTMLCanvasElement,
  grid: string[][],
  palette: Palette,
): void {
  const { rows, cols } = gridSize(grid) ?? { rows: 0, cols: 0 }
  if (rows === 0 || cols === 0) return

  const hexByCode = buildHexByCode(palette)

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
        const code = row[c]
        if (code === "") continue
        const hex = hexByCode.get(code)
        if (!hex) continue
        ctx.fillStyle = hex
        ctx.fillRect(c, r, 1, 1)
      }
    }
    return
  }

  const freq = new Map<number, Map<string, number>>()
  for (let r = 0; r < rows; r++) {
    const row = grid[r]
    const py = Math.min(ph - 1, Math.floor(r * scale))
    for (let c = 0; c < cols; c++) {
      const code = row[c]
      if (code === "") continue
      const px = Math.min(pw - 1, Math.floor(c * scale))
      const key = py * pw + px
      let bucket = freq.get(key)
      if (!bucket) {
        bucket = new Map()
        freq.set(key, bucket)
      }
      bucket.set(code, (bucket.get(code) ?? 0) + 1)
    }
  }
  for (const [key, bucket] of freq) {
    const best = mostFrequent(bucket)
    if (!best) continue
    const hex = hexByCode.get(best)
    if (!hex) continue
    ctx.fillStyle = hex
    ctx.fillRect(key % pw, Math.floor(key / pw), 1, 1)
  }
}

interface ExcludeColoursProps {
  palette: Palette
  excluded: string[]
  onToggle: (code: string) => void
  onToggleGroup: (codes: string[]) => void
  onReset: () => void
}

/**
 * Pick colours of the current brand to exclude from the image→grid conversion.
 * The palette is grouped by series, each group is collapsible and has a
 * "select whole series" checkbox; a search box filters by code, name, or series.
 */
function ExcludeColours({ palette, excluded, onToggle, onToggleGroup, onReset }: ExcludeColoursProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState("")
  // Groups are collapsed by default; only a search forces them open so matches
  // stay visible.
  const [openSeries, setOpenSeries] = useState<Set<string>>(new Set())

  const q = query.trim().toLowerCase()
  const filtered = q
    ? palette.colors.filter((c) =>
        [c.code, c.name, c.series ?? ""].some((s) => s.toLowerCase().includes(q)),
      )
    : palette.colors

  const groups = groupColorsBySeries(filtered, (c) => c.series ?? "?")

  const toggleOpen = (series: string) =>
    setOpenSeries((prev) => {
      const next = new Set(prev)
      if (next.has(series)) next.delete(series)
      else next.add(series)
      return next
    })

  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs">{t("editor.excludeColours")}</Label>
      <Popover>
        <PopoverTrigger
          render={
            <Button type="button" size="xs" variant="outline">
              {excluded.length > 0
                ? t("editor.excludedCount", { count: excluded.length })
                : t("editor.chooseColours")}
            </Button>
          }
        />
        <PopoverContent side="bottom" align="end" className="w-72 p-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("editor.excludeColoursSearch")}
              className="h-7 pl-6 text-xs md:text-xs"
            />
          </div>
          <div className="max-h-44 overflow-auto rounded-md border">
            {groups.length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">{t("editor.noColoursFound")}</p>
            )}
            {groups.map((group) => {
              const codes = group.colors.map((c) => c.code)
              const allExcluded = codes.every((c) => excluded.includes(c))
              const someExcluded = codes.some((c) => excluded.includes(c))
          const open = q.length > 0 || openSeries.has(group.series)
          return (
            <Collapsible
              key={group.series}
              open={open}
              onOpenChange={() => {
                if (q.length === 0) toggleOpen(group.series)
              }}
              className="border-b last:border-b-0"
            >
                  <div className="flex items-center gap-1 bg-muted/40 pl-1 pr-2 hover:bg-muted/70">
                    <CollapsibleTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="flex-1 justify-start gap-1.5 text-xs font-medium"
                        >
                          <ChevronRight
                            className={`size-3 transition-transform ${open ? "rotate-90" : ""}`}
                          />
                          {t("editor.series", { series: group.series })}
                          <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                            {group.colors.filter((c) => excluded.includes(c.code)).length}/{group.colors.length}
                          </span>
                        </Button>
                      }
                    />
                    <Checkbox
                      checked={allExcluded}
                      indeterminate={someExcluded && !allExcluded}
                      onCheckedChange={() => onToggleGroup(codes)}
                      aria-label={t("editor.toggleSeries", { series: group.series })}
                    />
                  </div>
                  <CollapsibleContent>
                    <ul>
                      {group.colors.map((color) => {
                        const on = excluded.includes(color.code)
                        const id = `excl-${color.code}`
                        return (
                          <li key={color.code}>
                            <Label
                              htmlFor={id}
                              className="flex w-full cursor-pointer items-center gap-2 px-2 py-1 text-xs font-normal hover:bg-muted"
                            >
                              <Checkbox id={id} checked={on} onCheckedChange={() => onToggle(color.code)} />
                              <span
                                className="inline-block h-3 w-3 shrink-0 rounded-sm border"
                                style={{ backgroundColor: color.hex }}
                              />
                              <span className={`flex-1 truncate ${on ? "text-muted-foreground line-through" : ""}`}>
                                {color.name ?? color.code}
                              </span>
                              <span className="shrink-0 text-muted-foreground">{color.code}</span>
                            </Label>
                          </li>
                        )
                      })}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
          {excluded.length > 0 && (
            <Button type="button" size="xs" variant="ghost" onClick={onReset} className="self-start">
              {t("editor.resetExclusion")}
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function ImportDialog({ open, onClose, onApply, palette: pinnedPalette, createWorker }: ImportDialogProps) {
  const { palette: storePalette } = usePalette()
  const palette = pinnedPalette ?? storePalette
  const { t } = useI18n()
  const [file, setFile] = useState<File | null>(null)
  const [widthInput, setWidthInput] = useState(String(DEFAULT_WIDTH))
  const [result, setResult] = useState<TransformResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  // Advanced conversion options, hidden by default.
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [mode, setMode] = useState<TransformMode>("average")
  const [mergeOn, setMergeOn] = useState(true)
  const [mergeSimilarity, setMergeSimilarity] = useState(DEFAULT_MERGE_SIMILARITY)
  const [removeBg, setRemoveBg] = useState(false)
  const [excludedCodes, setExcludedCodes] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reqId = useRef(0)
  const workerRef = useRef<Worker | null>(null)
  // Latest `t`, so the one-time worker handlers don't capture a stale locale.
  const tRef = useRef(t)

  useEffect(() => {
    tRef.current = t
  }, [t])

  // Terminate the worker when the dialog unmounts.
  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  // Convert when a file is chosen or the width changes (debounced). Each
  // trigger bumps `reqId` so a stale response from an earlier width edit is
  // dropped instead of overwriting a newer result. The conversion runs in a
  // Web Worker to avoid blocking the editor's main thread.
  useEffect(() => {
    if (!file || !palette) return
    const w = Math.round(Number(widthInput))
    if (!Number.isFinite(w) || w <= 0) return
    const clamped = Math.min(MAX_GRID_DIMENSION, w)
    const timeout = setTimeout(() => {
      const id = ++reqId.current
      if (!workerRef.current) {
        let worker: Worker | null
        try {
          worker = createWorker()
        } catch {
          setIsProcessing(false)
          toast.add({
            id: "import-conversion-failed",
            type: "error",
            title: tRef.current("editor.conversionFailed"),
            description: tRef.current("editor.networkError"),
          })
          return
        }
        if (!worker) {
          setIsProcessing(false)
          toast.add({
            id: "import-conversion-failed",
            type: "error",
            title: tRef.current("editor.conversionFailed"),
            description: tRef.current("editor.networkError"),
          })
          return
        }
        worker.onmessage = (event: MessageEvent<TransformResponse>) => {
          const message = event.data
          if (message.id !== reqId.current) return
          setIsProcessing(false)
          if (message.ok) {
            setResult(message.result)
          } else {
            setResult(null)
            toast.add({
              id: "import-conversion-failed",
              type: "error",
              title: tRef.current("editor.conversionFailed"),
              description: message.error,
            })
          }
        }
        worker.onerror = () => {
          setIsProcessing(false)
          setResult(null)
          toast.add({
            id: "import-conversion-failed",
            type: "error",
            title: tRef.current("editor.conversionFailed"),
            description: tRef.current("editor.networkError"),
          })
        }
        workerRef.current = worker
      }
      const request: TransformRequest = {
        id,
        file,
        width: clamped,
        mode,
        mergeSimilarity: mergeOn ? mergeSimilarity : 0,
        removeBackground: removeBg,
        excludedCodes,
        palette,
      }
      setIsProcessing(true)
      workerRef.current.postMessage(request)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [file, widthInput, palette, mode, mergeOn, mergeSimilarity, removeBg, excludedCodes, createWorker])

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

  const toggleExcluded = useCallback((code: string) => {
    setExcludedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    )
  }, [])

  const toggleExcludedGroup = useCallback((codes: string[]) => {
    setExcludedCodes((prev) => {
      if (codes.every((c) => prev.includes(c))) {
        const removed = new Set(codes)
        return prev.filter((c) => !removed.has(c))
      }
      return [...new Set([...prev, ...codes])]
    })
  }, [])

  const handleClose = useCallback(() => {
    reqId.current++
    setFile(null)
    setWidthInput(String(DEFAULT_WIDTH))
    setResult(null)
    setIsProcessing(false)
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
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
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

        <div className="border-t pt-2">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
            className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("editor.advancedOptions")}
            <ChevronDown
              className={`size-3.5 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            />
          </button>
          {advancedOpen && (
            <div className="grid gap-3 pt-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">{t("editor.importMode")}</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="xs"
                    variant={mode === "average" ? "secondary" : "outline"}
                    onClick={() => setMode("average")}
                  >
                    {t("editor.photoMode")}
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant={mode === "dominant" ? "secondary" : "outline"}
                    onClick={() => setMode("dominant")}
                  >
                    {t("editor.cartoonMode")}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="import-merge" className="text-xs">
                  {t("editor.mergeSimilar")}
                </Label>
                <Switch
                  id="import-merge"
                  checked={mergeOn}
                  onCheckedChange={(checked) => setMergeOn(checked)}
                />
              </div>
              {mergeOn && (
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="import-merge-level" className="text-xs">
                      {t("editor.mergeSimilarity")}
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {mergeSimilarity.toFixed(2)}
                    </span>
                  </div>
                  <input
                    id="import-merge-level"
                    type="range"
                    min={0.02}
                    max={0.5}
                    step={0.01}
                    value={mergeSimilarity}
                    onChange={(e) => setMergeSimilarity(Number(e.target.value))}
                    className="w-full accent-foreground"
                  />
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="import-bg" className="text-xs">
                  {t("editor.removeBackground")}
                </Label>
                <Switch
                  id="import-bg"
                  checked={removeBg}
                  onCheckedChange={(checked) => setRemoveBg(checked)}
                />
              </div>
              {palette && (
                <ExcludeColours
                  palette={palette}
                  excluded={excludedCodes}
                  onToggle={toggleExcluded}
                  onToggleGroup={toggleExcludedGroup}
                  onReset={() => setExcludedCodes([])}
                />
              )}
            </div>
          )}
        </div>

        {isProcessing && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Spinner className="size-3.5" />
            {t("editor.processing")}
          </p>
        )}

        {result && !isProcessing && (
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
          <Button onClick={handleApply} disabled={!result || isProcessing}>
            {t("editor.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
