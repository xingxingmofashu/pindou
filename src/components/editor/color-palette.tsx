"use client"

import { useEffect, useMemo } from "react"
import useSWR from "swr"
import { ChevronDown } from "lucide-react"
import { usePalette } from "@/hooks/use-palette"
import { cn, fetcher } from "@/lib/utils"
import { useI18n } from "@/i18n/client"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import type { Palette } from "@/types"

interface ColorPaletteProps {
  /**
   * Currently selected palette colour.
   * 0 = eraser / empty cell, 1..N = 1‑based index into `palette.colors`.
   */
  activeColorIndex: number
  /** Called when the user selects a colour (or the eraser). */
  onColorPick: (index: number) => void
  /**
   * Pin a specific brand palette (e.g. a pattern's own brand). When set, the
   * component skips the shared active-palette store and the catalog fetch, and
   * hides the brand switcher.
   */
  palette?: Palette
}

/**
 * Scrollable colour palette sidebar panel.
 *
 * A brand switcher sits in the header when the catalog holds more than one
 * brand. Colours of the active brand are grouped by series letter, plus an
 * eraser / empty-cell swatch at the top.
 */
export function ColorPalette({
  activeColorIndex,
  onColorPick,
  palette: pinned,
}: ColorPaletteProps) {
  const { palette: storePalette, setActivePalette } = usePalette()
  const { t } = useI18n()
  const palette = pinned ?? storePalette
  const { data: brands, error, isValidating, mutate } = useSWR<Array<Palette>>(
    pinned ? null : "/api/brands",
    fetcher,
  )

  useEffect(() => {
    if (pinned || !error || isValidating) return
    toast.add({
      id: "palette-load-failed",
      type: "error",
      title: t("editor.paletteLoadFailedTitle"),
      description: t("editor.paletteLoadFailedDescription"),
      actionProps: {
        children: t("common.retry"),
        onClick: () => mutate(),
      },
    })
  }, [error, isValidating, mutate, t, pinned])

  // Seed the active palette once the catalog arrives.
  useEffect(() => {
    const first = brands?.[0]
    if (pinned || !first || palette) return
    setActivePalette(first)
  }, [brands, palette, setActivePalette, pinned])

  /** Colours grouped by series letter, with 1‑based palette indices. */
  const seriesGroups = useMemo(() => {
    if (!palette) return []
    const map = new Map<string, { series: string; colors: { index: number; hex: string; code: string }[] }>()
    palette.colors.forEach((color, i) => {
      const series = color.series ?? "?"
      let group = map.get(series)
      if (!group) {
        group = { series, colors: [] }
        map.set(series, group)
      }
      group.colors.push({ index: i + 1, hex: color.hex, code: color.code })
    })
    return Array.from(map.values())
  }, [palette])

  /**
   * Switch the active brand and reset to the first colour.
   * The canvas is cleared on brand switch by usePixiCanvas.
   */
  const handleBrandChange = (code: string) => {
    const brand = brands?.find((b) => b.code === code)
    if (brand) {
      setActivePalette(brand)
      onColorPick(1)
    }
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center border px-3 py-2 text-xs text-muted-foreground">
        {t("editor.paletteLoadFailed")}
      </div>
    )
  }

  if (!palette) {
    return (
      <div className="flex h-full flex-col border px-3 py-2">
        <Skeleton className="h-4 w-24" />
        <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(1.5rem,1fr))] content-start gap-2 py-2">
          {Array.from({ length: 24 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-sm" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full border">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
        {(brands?.length ?? 0) > 1 ? (
          <div className="relative min-w-0 flex-1">
            <select
              value={palette.code}
              onChange={(e) => handleBrandChange(e.target.value)}
              aria-label={t("editor.beadBrand")}
              className="w-full cursor-pointer appearance-none rounded-none border-0 bg-transparent px-0 py-0 pr-4 text-xs font-medium text-muted-foreground focus:outline-none"
            >
              {brands?.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          </div>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">{palette.name}</span>
        )}
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {t("editor.colorsCount", { count: palette.colors.length })}
        </span>
      </div>
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="px-2 py-2 space-y-3">
        {/* Eraser / empty-cell swatch */}
        <div>
          <div className="text-[10px] uppercase text-muted-foreground mb-1 px-1">
            {t("editor.eraser")}
          </div>
          <button
            type="button"
            className={cn(
              "w-7 h-7 rounded-sm border",
              activeColorIndex === 0
                ? "ring-2 ring-ring ring-offset-1 ring-offset-background"
                : "hover:scale-110 transition-transform"
            )}
            style={{
              background:
                "repeating-linear-gradient(45deg, #ccc 0px, #ccc 2px, #fff 2px, #fff 4px)",
            }}
            onClick={() => onColorPick(0)}
            aria-label={t("editor.eraserAria")}
          />
        </div>

        {/* Series groups */}
        {seriesGroups.map((group) => (
          <div key={group.series}>
            <div className="text-[10px] uppercase text-muted-foreground mb-1 px-1">
              {group.series === "?" ? t("editor.colors") : t("editor.series", { series: group.series })}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(1.5rem,1fr))] gap-2">
              {group.colors.map(({ index, hex, code }) => (
                <button
                  key={index}
                  type="button"
                  className={cn(
                    "w-7 h-7 rounded-sm",
                    activeColorIndex === index
                      ? "ring-2 ring-ring ring-offset-1"
                      : "hover:scale-105 transition-transform"
                  )}
                  style={{ backgroundColor: hex }}
                  onClick={() => onColorPick(index)}
                  title={`${code} — ${hex}`}
                  aria-label={t("editor.colorAria", { code })}
                />
              ))}
            </div>
          </div>
        ))}
        </div>
      </ScrollArea>
    </div>
  )
}
