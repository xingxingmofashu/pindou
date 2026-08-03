"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { PatternCard } from "@/components/pattern/card"
import { Button } from "@/components/ui/button"
import { patternListResponseSchema, type PatternListResponse } from "@/lib/validation"

export default function PatternsPage() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PatternListResponse | null>(null)
  const [error, setError] = useState(false)

  const goToPage = (next: number) => {
    if (next < 1) return
    setError(false)
    setPage(next)
  }

  useEffect(() => {
    let cancelled = false
    fetch(`/api/patterns?page=${page}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Request failed"))))
      .then((d: unknown) => {
        if (cancelled) return
        const result = patternListResponseSchema.safeParse(d)
        if (result.success) setData(result.data)
        else setError(true)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [page])

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
            : data
              ? `${total.toLocaleString()} patterns published`
              : "Loading…"}
        </p>

        {error ? (
          <p className="text-sm text-muted-foreground">
            Something went wrong. Please try again later.
          </p>
        ) : data && list.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {list.map((p) => (
                <PatternCard key={p.id} {...p} />
              ))}
            </div>

            {totalPages > 1 && (
              <nav className="mt-8 flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  Next
                </Button>
              </nav>
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
