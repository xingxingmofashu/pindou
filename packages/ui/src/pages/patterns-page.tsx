"use client"

import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { formatRelativeDate } from "@pindou/core/date"
import { useI18n } from "@pindou/core/i18n/client"
import { Button } from "../components/ui/button"
import { Card, CardHeader, CardTitle } from "../components/ui/card"
import { Input } from "../components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "../components/ui/pagination"
import type { Locale } from "@pindou/core/i18n/config"

/** 1×1 transparent GIF — placeholder `src` for a failed/empty thumbnail. */
const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"

/** One gallery entry, already normalized by the host (web: API row; desktop:
 *  SQLite row). Dates are ISO strings formatted by the shared card. */
export interface PatternItem {
  id: string
  title: string
  /** Public thumbnail URL (web). Omit and provide `getThumbnail` for desktop. */
  thumbUrl?: string
  /** Author display name (web); omitted on desktop. */
  authorName?: string | null
  /** ISO date shown as a relative label (web: createdAt; desktop: updatedAt). */
  date: string
  /** Pre-computed bead count. */
  beads: number
}

/**
 * Shared pattern gallery page (web `/patterns` + desktop `/patterns`): search
 * box, card grid, and empty states. The host owns data fetching, filtering,
 * and pagination — the page renders the already-filtered `items` and reports
 * search/clear/navigation through callbacks.
 */
export interface PatternsPageProps {
  /** Top-bar heading ("Patterns"). */
  title: string
  /** Top-bar count label ("N patterns"). */
  countLabel: string
  /** Pre-filtered items to render. */
  items: PatternItem[]
  /** Current search query (drives the input's value). */
  query: string
  /** Show the loading state. */
  loading?: boolean
  /** Search placeholder + aria label. */
  searchPlaceholder: string
  searchAriaLabel: string
  /** Fired on search submit. */
  onSearch: (q: string) => void
  /** Clear the search (empty state action). */
  onClearSearch: () => void
  /** Open a pattern. */
  onOpen: (id: string) => void
  /** Resolve a thumbnail URL lazily (desktop reads a local file). */
  getThumbnail?: (id: string) => Promise<string | null> | string | null
  /** Empty-state copy + action. */
  emptyTitle: string
  emptyActionLabel?: string
  onEmptyAction?: () => void
  /** Pagination (web only). Omit to hide the control. */
  page?: number
  totalPages?: number
  /** Fired with the target page when the user navigates. */
  onPageChange?: (page: number) => void
}

export function PatternsPage({
  title,
  countLabel,
  items,
  query,
  loading = false,
  searchPlaceholder,
  searchAriaLabel,
  onSearch,
  onClearSearch,
  onOpen,
  getThumbnail,
  emptyTitle,
  emptyActionLabel,
  onEmptyAction,
  page,
  totalPages,
  onPageChange,
}: PatternsPageProps) {
  const { locale, t } = useI18n()

  // Page navigation via callback (web soft-navigates, desktop has none).
  const goToPage = (target: number) => (e: { preventDefault: () => void }) => {
    e.preventDefault()
    onPageChange?.(target)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col border">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <h1 className="text-sm font-semibold">{title}</h1>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground">{countLabel}</p>
            <PatternSearch
              initialQuery={query}
              placeholder={searchPlaceholder}
              ariaLabel={searchAriaLabel}
              onSearch={onSearch}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">{emptyTitle}</p>
              {query ? (
                <Button variant="outline" size="sm" onClick={onClearSearch}>
                  {t("patterns.clearSearch")}
                </Button>
              ) : (
                emptyActionLabel &&
                onEmptyAction && (
                  <Button variant="outline" size="sm" onClick={onEmptyAction}>
                    {emptyActionLabel}
                  </Button>
                )
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {items.map((p) => (
                  <PatternCard
                    key={p.id}
                    item={p}
                    locale={locale}
                    onOpen={() => onOpen(p.id)}
                    getThumbnail={getThumbnail}
                  />
                ))}
              </div>
              {totalPages !== undefined && totalPages > 1 && onPageChange && (
                <Pagination className="mt-4">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        aria-disabled={page! <= 1}
                        className={page! <= 1 ? "pointer-events-none opacity-50" : undefined}
                        onClick={page! > 1 ? goToPage(page! - 1) : undefined}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="px-3 text-sm text-muted-foreground">
                        {t("patterns.pageOf", {
                          page: String(page ?? 1),
                          total: String(totalPages),
                        })}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        aria-disabled={page! >= totalPages}
                        className={page! >= totalPages ? "pointer-events-none opacity-50" : undefined}
                        onClick={page! < totalPages ? goToPage(page! + 1) : undefined}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Search box; submits via the injected `onSearch` (web soft-navigates, desktop filters locally). */
function PatternSearch({
  initialQuery,
  placeholder,
  ariaLabel,
  onSearch,
}: {
  initialQuery: string
  placeholder: string
  ariaLabel: string
  onSearch: (q: string) => void
}) {
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const input = new FormData(e.currentTarget).get("q")
        const q = typeof input === "string" ? input.trim() : ""
        onSearch(q)
      }}
    >
      <div className="relative">
        <Input
          key={initialQuery}
          name="q"
          defaultValue={initialQuery}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="h-8 w-40 pr-8 sm:w-48"
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label={ariaLabel}
          className="absolute right-0 top-0 text-muted-foreground hover:text-foreground"
        >
          <Search />
        </Button>
      </div>
    </form>
  )
}

/** One gallery entry: thumbnail, title, optional author, bead count, date. */
function PatternCard({
  item,
  locale,
  onOpen,
  getThumbnail,
}: {
  item: PatternItem
  locale: Locale
  onOpen: () => void
  getThumbnail?: PatternsPageProps["getThumbnail"]
}) {
  const { t } = useI18n()
  const [thumbSrc, setThumbSrc] = useState<string | null>(item.thumbUrl ?? null)
  const [thumbFailed, setThumbFailed] = useState(false)

  // Desktop resolves thumbnails asynchronously from local storage; web passes
  // the URL directly so getThumbnail is a no-op.
  useEffect(() => {
    if (item.thumbUrl || !getThumbnail || thumbSrc) return
    let cancelled = false
    void Promise.resolve(getThumbnail(item.id)).then((url) => {
      if (!cancelled && url) setThumbSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [item.id, item.thumbUrl, getThumbnail, thumbSrc])

  const relativeDate = formatRelativeDate(item.date, locale)

  return (
    <Card
      className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
      onClick={onOpen}
    >
      <img
        src={thumbSrc && !thumbFailed ? thumbSrc : TRANSPARENT_PIXEL}
        alt=""
        className="block aspect-square w-full bg-muted object-cover [image-rendering:pixelated]"
        onError={() => setThumbFailed(true)}
      />
      <CardHeader>
        <CardTitle className="truncate">{item.title || t("desktop.untitled")}</CardTitle>
        <p className="truncate text-xs text-muted-foreground">
          {t("patternCard.beads", { count: item.beads.toLocaleString() })}
          <span aria-hidden="true"> · </span>
          {relativeDate}
          {item.authorName ? (
            <>
              <span aria-hidden="true"> · </span>
              {item.authorName}
            </>
          ) : null}
        </p>
      </CardHeader>
    </Card>
  )
}
