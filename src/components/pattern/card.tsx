"use client"

import Link from "next/link"
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

  return (
    <Link href={localizedPath(locale, `/patterns/${id}`)} className="block">
      <Card>
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={title}
            className="block aspect-square w-full bg-muted object-cover"
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
