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
import type { PatternResponseType } from "@/db/schema"

export default function PatternsPage() {
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
      title: "Failed to load patterns",
      description: "Something went wrong. Please try again.",
      actionProps: {
        children: "Retry",
        onClick: () => mutate(),
      },
    })
  }, [error, isValidating, mutate])

  const list = data?.patterns ?? []
  const total = data?.pagination.total ?? 0
  const totalPages = data
    ? Math.ceil(data.pagination.total / data.pagination.pageSize)
    : 0

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="mb-1 text-xl font-semibold">Patterns</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {error
            ? "Failed to load patterns."
            : data
              ? `${total.toLocaleString()} patterns published`
              : ""}
        </p>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
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
              <Pagination className="mt-8">
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
                      Page {page} of {totalPages}
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
          <div className="flex flex-1 items-center justify-center text-center">
            <div>
              <p className="text-sm text-muted-foreground">No patterns published yet.</p>
              <Link
                href="/editor"
                className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
              >
                Create the first one
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
