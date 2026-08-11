import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { getPattern } from "@/lib/server/patterns"
import { getBrandPalette } from "@/lib/server/palettes"
import { PatternViewer } from "@/components/pattern/detail/viewer"
import { PatternDetailPanel } from "@/components/pattern/detail/panel"
import { PatternZoomControls } from "@/components/pattern/detail/zoom-controls"
import { Button } from "@/components/ui/button"
import { parseBeadStats, totalBeadCount } from "@/lib/utils"
import { pageMetadata } from "@/lib/server/meta"
import { localizedPath, isLocale } from "@/i18n/config"
import { getDictionary, getLocale } from "@/i18n/server"
import { auth } from "@/lib/auth/server"
import { format, formatDistanceToNow, parseISO, isValid } from "date-fns"
import { zhCN } from "date-fns/locale"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}): Promise<Metadata> {
  const [{ lang, id }, locale] = await Promise.all([params, getLocale()])
  const dict = await getDictionary(isLocale(lang) ? lang : undefined)
  const pattern = await getPattern(id)
  if (!pattern) return {}

  return pageMetadata({
    locale,
    path: `/patterns/${id}`,
    title: `${pattern.title} — ${dict.meta.title}`,
    description: pattern.description || dict.meta.description,
    image: pattern.thumbUrl || undefined,
  })
}

export default async function PatternDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const [{ id }, locale] = await Promise.all([params, getLocale()])
  const dict = await getDictionary()
  const dateLocale = locale === "zh" ? zhCN : undefined

  const [pattern, session] = await Promise.all([
    getPattern(id),
    auth.api.getSession({ headers: await headers() }),
  ])
  if (!pattern) notFound()
  if (!pattern.grid) notFound()

  const palette = await getBrandPalette(pattern.brandId)
  if (!palette) notFound()

  const grid = pattern.grid
  const beadStats = parseBeadStats(pattern.beadStats)
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const totalBeads = totalBeadCount(beadStats)

  const sortedStats = Object.entries(beadStats)
    .sort(([, a], [, b]) => b - a)
    .map(([code, count]) => {
      const color = palette.colors.find((c) => c.code === code)
      return { code, count, name: color?.name, hex: color?.hex }
    })

  const createdAt = parseISO(pattern.createdAt)
  const absoluteDate = isValid(createdAt)
    ? format(createdAt, dict.patternDetail.dateFormat, { locale: dateLocale })
    : ""
  const relativeDate = isValid(createdAt)
    ? formatDistanceToNow(createdAt, { addSuffix: true, locale: dateLocale })
    : ""

  const canEdit = Boolean(session && session.user.id === pattern.fkUserId)

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2 border px-3 py-2">
        <h1 className="min-w-0 truncate text-sm font-semibold">{pattern.title}</h1>
        <div className="flex shrink-0 items-center gap-2">
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={localizedPath(locale, `/patterns/${id}/edit`)} />}
            >
              {dict.patternDetail.edit}
            </Button>
          )}
          <PatternZoomControls />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 gap-2">
        <PatternDetailPanel
          authorName={pattern.authorName ?? null}
          relativeDate={relativeDate}
          absoluteDate={absoluteDate}
          description={pattern.description || null}
          cols={cols}
          rows={rows}
          totalBeads={totalBeads}
          brand={palette.name}
          sortedStats={sortedStats}
        />
        <PatternViewer grid={grid} palette={palette} className="min-h-0 flex-1 border" />
      </div>
    </div>
  )
}