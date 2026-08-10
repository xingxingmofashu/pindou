"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { formatDistanceToNow, parseISO, isValid } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { totalBeadCount } from "@/lib/utils"
import { localizedPath } from "@/i18n/config"
import { useI18n } from "@/i18n/client"

interface PatternCardProps {
  id: string
  title: string
  authorName: string | null
  beadStats: Record<string, number>
  createdAt: string
  thumbUrl: string
}

export function PatternCard({ id, title, authorName, beadStats, createdAt, thumbUrl }: PatternCardProps) {
  const { locale, t } = useI18n()
  const dateLocale = locale === "zh" ? zhCN : undefined
  const totalBeads = totalBeadCount(beadStats)
  const date = parseISO(createdAt)
  const relativeDate = isValid(date) ? formatDistanceToNow(date, { addSuffix: true, locale: dateLocale }) : ""
  // If the thumbnail fails to load (e.g. a network/proxy blocks the R2 host),
  // fall back to the same muted placeholder used for missing thumbnails instead
  // of rendering a broken image icon.
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
