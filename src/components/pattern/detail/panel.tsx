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
  return (
    <div className="w-56 shrink-0 overflow-auto flex flex-col gap-4 border p-3">
      <h1 className="text-base font-semibold tracking-tight leading-snug break-words">{title}</h1>
      <div className="space-y-1.5">
        <div>
          <span className="text-xs text-muted-foreground">Grid</span>
          <p className="text-sm tabular-nums">
            {cols} × {rows} · {totalBeads.toLocaleString()} beads
          </p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Brand</span>
          <p className="text-sm">{brand}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Author</span>
          <p className="text-sm truncate">{authorName ?? "Anonymous"}</p>
        </div>
        {relativeDate && (
          <div>
            <span className="text-xs text-muted-foreground">Published</span>
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
          <h2 className="text-sm font-semibold mb-2">Beads Used</h2>
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
