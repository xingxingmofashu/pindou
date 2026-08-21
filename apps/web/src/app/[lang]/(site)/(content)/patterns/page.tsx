import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getPatternsPage } from "@/lib/server/patterns"
import { parseBeadStats } from "@/lib/utils"
import { pageMetadata } from "@/lib/server/meta"
import { PATTERNS_PAGE_SIZE } from "@pindou/shared/constants"
import { localizedPath } from "@pindou/core/i18n/config.ts"
import { getDictionary, getLocale } from "@/i18n/server"
import { PaginationSchema } from "@/db/schema"
import { PatternsContentClient } from "./client"

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

/**
 * Patterns catalog — server page. Fetches the paginated list from the cached
 * `getPatternsPage` query, redirects out-of-range pages, then hands the
 * resolved rows to a client component that renders the grid, search, and
 * pagination.
 */
export default async function PatternsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const locale = await getLocale()
  const { page: pageParam, q: qParam } = await searchParams
  const parsed = PaginationSchema.safeParse({ page: pageParam, pageSize: PATTERNS_PAGE_SIZE })
  const requested = parsed.success ? parsed.data.page : 1
  const q = typeof qParam === "string" ? qParam.trim().slice(0, 100) : ""

  const { rows, total } = await getPatternsPage(requested, PATTERNS_PAGE_SIZE, q || undefined)
  const totalPages = Math.max(1, Math.ceil(total / PATTERNS_PAGE_SIZE))
  // Out-of-range pages (e.g. ?page=999) would otherwise render the empty state
  // despite patterns existing — redirect to the last valid page instead.
  const page = Math.min(requested, totalPages)
  if (page !== requested) {
    const params = new URLSearchParams(q ? { q } : {})
    params.set("page", String(page))
    redirect(localizedPath(locale, `/patterns?${params}`))
  }
  const list = rows.map((r) => ({
    ...r,
    beadStats: parseBeadStats(r.beadStats),
  }))

  return <PatternsContentClient q={q} page={page} totalPages={totalPages} total={total} list={list} />
}
