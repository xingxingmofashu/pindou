"use client"

import { useI18n } from "@/i18n/client"

interface PatternDetailPanelProps {
  title: string
  authorName: string | null
  relativeDate: string
  absoluteDate: string
  description: string | null
  cols: number
  rows: number
  totalBeads: number
  brand: string
  sortedStats: { code: string; count: number; name?: string; hex?: string }[]
}

export function PatternDetailPanel({
  title,
  authorName,
  relativeDate,
  absoluteDate,
  description,
  cols,
  rows,
  totalBeads,
  brand,
  sortedStats,
}: PatternDetailPanelProps) {
  const { t } = useI18n()

  return (
    <div className="w-56 shrink-0 overflow-auto flex flex-col gap-4 border p-3">
      <h1 className="text-base font-semibold tracking-tight leading-snug break-words">{title}</h1>
      <div className="space-y-1.5">
        <div>
          <span className="text-xs text-muted-foreground">{t("patternDetail.grid")}</span>
          <p className="text-sm tabular-nums">
            {cols} × {rows} · {t("patternCard.beads", { count: totalBeads.toLocaleString() })}
          </p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">{t("patternDetail.brand")}</span>
          <p className="text-sm">{brand}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">{t("patternDetail.author")}</span>
          <p className="text-sm truncate">{authorName ?? t("patternDetail.anonymous")}</p>
        </div>
        {relativeDate && (
          <div>
            <span className="text-xs text-muted-foreground">{t("patternDetail.published")}</span>
            <p className="text-sm" title={absoluteDate}>
              {relativeDate}
            </p>
          </div>
        )}
        {description && (
          <p className="text-sm leading-relaxed pt-1 border-t">{description}</p>
        )}
      </div>

      {sortedStats.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">{t("patternDetail.beadsUsed")}</h2>
          <div className="space-y-1">
            {sortedStats.map(({ code, count, name, hex }) => (
              <div key={code} className="flex items-center gap-2 text-sm">
                <span
                  className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm border"
                  style={{ backgroundColor: hex ?? "#ccc" }}
                />
                <span className="truncate flex-1">{name ?? code}</span>
                <span className="text-muted-foreground tabular-nums text-xs">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
