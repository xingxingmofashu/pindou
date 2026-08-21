import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { getPattern } from "@/lib/server/patterns"
import { getBrandPalette } from "@/lib/server/palettes"
import { pageMetadata } from "@/lib/server/meta"
import { getDictionary, getLocale } from "@/i18n/server"
import { isLocale } from "@pindou/core/i18n/config.ts"
import { auth } from "@/lib/auth/server"
import { PatternDetailClient } from "./client"
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
  const { id } = await params

  const [pattern, session] = await Promise.all([
    getPattern(id),
    auth.api.getSession({ headers: await headers() }),
  ])
  if (!pattern || !pattern.grid) notFound()

  const palette = await getBrandPalette(pattern.brandId)
  if (!palette) notFound()

  const canEdit = Boolean(session && session.user.id === pattern.fkUserId)

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
    canEdit,
  }

  return <PatternDetailClient id={id} pattern={detail} palette={palette} />
}
