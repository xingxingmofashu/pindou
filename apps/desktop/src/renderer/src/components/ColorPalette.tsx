import { useMemo } from "react"
import { ChevronDown } from "lucide-react"
import { groupColorsBySeries } from "@pindou/core/editor"
import { cn } from "@pindou/ui/utils"
import { useI18n } from "@pindou/core/i18n/client"
import { ScrollArea } from "@pindou/ui/components/ui/scroll-area"
import type { Palette } from "@pindou/shared/types"

interface ColorPaletteProps {
  /**
   * Currently selected palette colour.
   * 0 = eraser / empty cell, 1..N = 1‑based index into `palette.colors`.
   */
  activeColorIndex: number
  /** Called when the user selects a colour (or the eraser). */
  onColorPick: (index: number) => void
  /** All brands loaded from the local catalog (for the brand switcher). */
  brands: Palette[]
  /** The active brand (controlled by the host). */
  palette: Palette
  /** Called when the user picks a different brand. */
  onBrandChange: (code: string) => void
}

/**
 * Scrollable colour palette sidebar panel — desktop variant.
 *
 * Unlike the web version (which fetches the catalog over SWR and seeds the
 * shared store), the desktop app passes the full catalog and the active brand
 * as controlled props, so the host owns palette state.
 */
export function ColorPalette({
  activeColorIndex,
  onColorPick,
  brands,
  palette,
  onBrandChange,
}: ColorPaletteProps) {
  const { t } = useI18n()

  /** Colours grouped by series letter, with 1‑based palette indices. */
  const seriesGroups = useMemo(() => {
    // Indices are palette-wide (1..N), so decorate colors before grouping.
    return groupColorsBySeries(
      palette.colors.map((color, i) => ({ ...color, index: i + 1 })),
      (c) => c.series ?? "?",
    )
  }, [palette])

  return (
    <div className="flex h-full flex-col border">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        {brands.length > 1 ? (
          <div className="relative min-w-0 flex-1">
            <select
              value={palette.code}
              onChange={(e) => onBrandChange(e.target.value)}
              aria-label={t("editor.beadBrand")}
              className="w-full cursor-pointer appearance-none rounded-none border-0 bg-transparent px-0 py-0 pr-4 text-xs font-medium text-muted-foreground focus:outline-none"
            >
              {brands.map((b) => (
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
        <div className="space-y-3 px-2 py-2">
          {/* Eraser / empty-cell swatch */}
          <div>
            <div className="mb-1 px-1 text-[10px] uppercase text-muted-foreground">
              {t("editor.eraser")}
            </div>
            <button
              type="button"
              className={cn(
                "h-7 w-7 rounded-sm border",
                activeColorIndex === 0
                  ? "ring-2 ring-ring ring-offset-1 ring-offset-background"
                  : "transition-transform hover:scale-110",
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
              <div className="mb-1 px-1 text-[10px] uppercase text-muted-foreground">
                {group.series === "?" ? t("editor.colors") : t("editor.series", { series: group.series })}
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(1.5rem,1fr))] gap-2">
                {group.colors.map(({ index, hex, code }) => (
                  <button
                    key={index}
                    type="button"
                    className={cn(
                      "h-7 w-7 rounded-sm",
                      activeColorIndex === index
                        ? "ring-2 ring-ring ring-offset-1"
                        : "transition-transform hover:scale-105",
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
