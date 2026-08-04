"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { PatternCard } from "@/components/pattern/card"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { cn, fetcher, parseBeadStats } from "@/lib/utils"
import type { PatternListResponse } from "@/lib/validation"

export default function PatternsPage() {
  const [page, setPage] = useState(1)
  const { data, error, isLoading } = useSWR<PatternListResponse>(
    `/api/patterns?page=${page}`,
    fetcher,
  )

  const goToPage = (next: number) => {
    if (next < 1) return
    setPage(next)
  }

  const list = data?.patterns ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="mb-1 text-xl font-semibold">Patterns</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {error
            ? "Failed to load patterns."
            : isLoading
              ? "Loading…"
              : `${total.toLocaleString()} patterns published`}
        </p>

        {error ? (
          <p className="text-sm text-muted-foreground">
            Something went wrong. Please try again later.
          </p>
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
                        goToPage(page - 1)
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
                        goToPage(page + 1)
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
