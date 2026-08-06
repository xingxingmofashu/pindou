"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { PatternCard } from "@/components/pattern/card"
import { Card, CardHeader } from "@/components/ui/card"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { cn, fetcher, parseBeadStats } from "@/lib/utils"
import { localizedPath } from "@/i18n/config"
import { useI18n } from "@/i18n/client"
import type { PatternResponseType } from "@/db/schema"

export default function PatternsPage() {
  const { locale, t } = useI18n()
  const [page, setPage] = useState(1)
  const { data, error, isLoading, isValidating, mutate } = useSWR<PatternResponseType>(
    `/api/patterns?page=${page}`,
    fetcher,
  )

  useEffect(() => {
    if (!error || isValidating) return
    toast.add({
      id: "patterns-load-failed",
      type: "error",
      title: t("patterns.loadFailedTitle"),
      description: t("patterns.loadFailedDescription"),
      actionProps: {
        children: t("common.retry"),
        onClick: () => mutate(),
      },
    })
  }, [error, isValidating, mutate, t])

  const list = data?.patterns ?? []
  const total = data?.pagination.total ?? 0
  const totalPages = data
    ? Math.ceil(data.pagination.total / data.pagination.pageSize)
    : 0

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col border">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <h1 className="text-sm font-semibold">{t("patterns.title")}</h1>
          <p className="text-[10px] text-muted-foreground">
            {error
              ? t("patterns.error")
              : data
                ? t("patterns.publishedCount", { count: total.toLocaleString() })
                : ""}
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <Card className="pt-0" key={i}>
                  <Skeleton className="aspect-square w-full rounded-none" />
                  <CardHeader>
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="mt-2 h-3 w-1/2" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : data && list.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {list.map((p) => (
                  <PatternCard
                    key={p.id}
                    id={p.id}
                    title={p.title}
                    authorName={p.authorName ?? null}
                    beadStats={parseBeadStats(p.beadStats)}
                    createdAt={p.createdAt}
                    thumbPng={p.thumbPng}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <Pagination className="mt-4">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        aria-disabled={page <= 1}
                        className={cn(page <= 1 && "pointer-events-none opacity-50")}
                        onClick={(e) => {
                          e.preventDefault()
                          setPage(page - 1)
                        }}
                      />
                    </PaginationItem>

                    <PaginationItem>
                      <span className="px-3 text-sm text-muted-foreground">
                        {t("patterns.pageOf", { page, total: totalPages })}
                      </span>
                    </PaginationItem>

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        aria-disabled={page >= totalPages}
                        className={cn(page >= totalPages && "pointer-events-none opacity-50")}
                        onClick={(e) => {
                          e.preventDefault()
                          setPage(page + 1)
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          ) : data ? (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <p className="text-sm text-muted-foreground">{t("patterns.empty")}</p>
                <Link
                  href={localizedPath(locale, "/editor")}
                  className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                >
                  {t("patterns.createFirst")}
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
