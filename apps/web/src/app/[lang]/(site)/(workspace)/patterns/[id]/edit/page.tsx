import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { getPattern } from "@/lib/server/patterns"
import { getBrandPalette } from "@/lib/server/palettes"
import { pageMetadata } from "@/lib/server/meta"
import { getDictionary, getLocale } from "@/i18n/server"
import { isLocale, localizedPath } from "@/i18n/config"
import { auth } from "@/lib/auth/server"
import { Button } from "@pindou/ui/components/ui/button"
import { PatternEditContentClient } from "./client"
import type { PatternDetailType } from "@/db/schema"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}): Promise<Metadata> {
  const [{ lang, id }, locale] = await Promise.all([params, getLocale()])
  const dict = await getDictionary(isLocale(lang) ? lang : undefined)
  const pattern = await getPattern(id)
  if (!pattern || !pattern.grid) return {}

  return pageMetadata({
    locale,
    path: `/patterns/${id}/edit`,
    title: `${dict.patternDetail.editTitle} — ${pattern.title}`,
    description: dict.meta.description,
  })
}

export default async function PatternEditPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { id } = await params
  const locale = await getLocale()
  const dict = await getDictionary()

  const [pattern, session] = await Promise.all([
    getPattern(id),
    auth.api.getSession({ headers: await headers() }),
  ])
  if (!pattern || !pattern.grid) notFound()

  const palette = await getBrandPalette(pattern.brandId)
  if (!palette) notFound()

  // Only the author may edit; show a friendly notice (the API 403s anyway).
  if (!(session && session.user.id === pattern.fkUserId)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 border p-6 text-center">
        <p className="text-sm text-muted-foreground">{dict.patternDetail.notOwnerDescription}</p>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={localizedPath(locale, `/patterns/${id}`)} />}
        >
          {dict.patternDetail.backToPattern}
        </Button>
      </div>
    )
  }

  const detail: PatternDetailType = {
    id: pattern.id,
    title: pattern.title,
    description: pattern.description,
    authorName: pattern.authorName,
    brandCode: pattern.brandCode,
    brandId: pattern.brandId,
    gridData: pattern.grid,
    beadStats: pattern.beadStats,
    thumbUrl: pattern.thumbUrl,
    createdAt: pattern.createdAt,
    updatedAt: pattern.updatedAt,
    canEdit: true,
  }

  return <PatternEditContentClient key={pattern.id} id={id} pattern={detail} palette={palette} />
}
