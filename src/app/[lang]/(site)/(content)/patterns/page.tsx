import type { Metadata } from "next"
import Link from "next/link"
import { getPatternsPage } from "@/lib/server/patterns"
import { PatternCard } from "@/components/pattern/card"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { parseBeadStats } from "@/lib/utils"
import { pageMetadata } from "@/lib/server/meta"
import { localizedPath } from "@/i18n/config"
import { getDictionary, getLocale } from "@/i18n/server"
import { PaginationSchema } from "@/db/schema"

const PAGE_SIZE = 20

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const dict = await getDictionary()
  return pageMetadata({
    locale,
    path: "/patterns",
    title: dict.meta.title,
    description: dict.meta.description,
  })
}

export default async function PatternsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const locale = await getLocale()
  const dict = await getDictionary()
  const { page: pageParam } = await searchParams
  const parsed = PaginationSchema.safeParse({ page: pageParam, pageSize: PAGE_SIZE })
  const page = parsed.success ? parsed.data.page : 1

  const { rows, total } = await getPatternsPage(page, PAGE_SIZE)
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const list = rows.map((r) => ({
    ...r,
    beadStats: parseBeadStats(r.beadStats),
  }))

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col border">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <h1 className="text-sm font-semibold">{dict.patterns.title}</h1>
          <p className="text-[10px] text-muted-foreground">
            {dict.patterns.publishedCount.replace("{count}", total.toLocaleString())}
          </p>
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
                    authorName={p.authorName ?? null}
                    beadStats={p.beadStats}
                    createdAt={p.createdAt}
                    thumbUrl={p.thumbUrl}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <Pagination className="mt-4">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href={page > 1 ? `?page=${page - 1}` : undefined}
                        aria-disabled={page <= 1}
                        className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                      />
                    </PaginationItem>

                    <PaginationItem>
                      <span className="px-3 text-sm text-muted-foreground">
                        {dict.patterns.pageOf.replace("{page}", String(page)).replace("{total}", String(totalPages))}
                      </span>
                    </PaginationItem>

                    <PaginationItem>
                      <PaginationNext
                        href={page < totalPages ? `?page=${page + 1}` : undefined}
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
                <p className="text-sm text-muted-foreground">{dict.patterns.empty}</p>
                <Link
                  href={localizedPath(locale, "/editor")}
                  className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                >
                  {dict.patterns.createFirst}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
