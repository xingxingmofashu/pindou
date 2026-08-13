"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { totalBeadCount } from "@/lib/utils"
import { formatRelativeDate } from "@/lib/date"
import { localizedPath } from "@/i18n/config"
import { useI18n } from "@/i18n/client"

export interface PatternListItem {
  id: string
  title: string
  authorName: string | null
  beadStats: Record<string, number>
  createdAt: string
  thumbUrl: string
}

/**
 * Client render of the catalog grid + search + pagination. Receives
 * server-fetched data as props; search and pagination navigate via soft client
 * transitions (`router.push` / plain links), which re-render the server page.
 */
export function PatternsContentClient({
  q,
  page,
  totalPages,
  total,
  list,
}: {
  q: string
  page: number
  totalPages: number
  total: number
  list: PatternListItem[]
}) {
  const { locale, t } = useI18n()
  // Query-string suffix appended to pagination links so the search term
  // survives page navigation.
  const searchSuffix = q ? `&q=${encodeURIComponent(q)}` : ""

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col border">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <h1 className="text-sm font-semibold">{t("patterns.title")}</h1>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground">
              {t("patterns.publishedCount", { count: total.toLocaleString() })}
            </p>
            <PatternSearch
              locale={locale}
              initialQuery={q}
              placeholder={t("patterns.searchPlaceholder")}
              ariaLabel={t("patterns.searchAria")}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {list.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {list.map((p) => (
                  <PatternCard
                    key={p.id}
                    id={p.id}
                    title={p.title}
                    authorName={p.authorName}
                    beadStats={p.beadStats}
                    createdAt={p.createdAt}
                    thumbUrl={p.thumbUrl}
                    locale={locale}
                    t={t}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <Pagination className="mt-4">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href={page > 1 ? `?page=${page - 1}${searchSuffix}` : undefined}
                        aria-disabled={page <= 1}
                        className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                      />
                    </PaginationItem>

                    <PaginationItem>
                      <span className="px-3 text-sm text-muted-foreground">
                        {t("patterns.pageOf", {
                          page: String(page),
                          total: String(totalPages),
                        })}
                      </span>
                    </PaginationItem>

                    <PaginationItem>
                      <PaginationNext
                        href={page < totalPages ? `?page=${page + 1}${searchSuffix}` : undefined}
                        aria-disabled={page >= totalPages}
                        className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <p className="text-sm text-muted-foreground">
                  {q ? t("patterns.noResults") : t("patterns.empty")}
                </p>
                {q ? (
                  <Link
                    href={localizedPath(locale, "/patterns")}
                    className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    {t("patterns.clearSearch")}
                  </Link>
                ) : (
                  <Link
                    href={localizedPath(locale, "/editor")}
                    className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    {t("patterns.createFirst")}
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Search box for the patterns catalog. Submits via `router.push` so the page
 *  soft-navigates to the new `?q=` URL without a full browser reload. */
function PatternSearch({
  locale,
  initialQuery,
  placeholder,
  ariaLabel,
}: {
  locale: Parameters<typeof localizedPath>[0]
  initialQuery: string
  placeholder: string
  ariaLabel: string
}) {
  const router = useRouter()

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const input = new FormData(e.currentTarget).get("q")
        const q = typeof input === "string" ? input.trim() : ""
        router.push(localizedPath(locale, q ? `/patterns?q=${encodeURIComponent(q)}` : "/patterns"))
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

/** One catalog entry: thumbnail, title, author, bead count, and publish date. */
function PatternCard({
  id,
  title,
  authorName,
  beadStats,
  createdAt,
  thumbUrl,
  locale,
  t,
}: {
  id: string
  title: string
  authorName: string | null
  beadStats: Record<string, number>
  createdAt: string
  thumbUrl: string
  locale: Parameters<typeof localizedPath>[0]
  t: (path: string, vars?: Record<string, string | number>) => string
}) {
  const totalBeads = totalBeadCount(beadStats)
  const relativeDate = formatRelativeDate(createdAt, locale)
  // If the thumbnail fails to load (e.g. a network/proxy blocks the R2 host),
  // fall back to the muted placeholder instead of rendering a broken image.
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <Link href={localizedPath(locale, `/patterns/${id}`)} className="block">
      <Card>
        {thumbUrl && !imageFailed ? (
          <Image
            src={thumbUrl}
            alt={title}
            // Thumbnails are fixed 480×480 (see Thumbnail.SIZE); rendering a
            // real <img> keeps the Card's `:first-child` styles (no top
            // padding, top corners rounded) exactly as the old <img> did.
            width={480}
            height={480}
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
            className="block aspect-square w-full bg-muted object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="aspect-square w-full bg-muted" />
        )}
        <CardHeader>
          <CardTitle className="truncate">
            {title}
            {authorName && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">{authorName}</span>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground truncate">
            {t("patternCard.beads", { count: totalBeads.toLocaleString() })}
            <span aria-hidden="true"> · </span>
            {relativeDate}
          </p>
        </CardHeader>
      </Card>
    </Link>
  )
}
