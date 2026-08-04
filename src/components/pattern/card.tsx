import Link from "next/link"
import { formatDistanceToNow, parseISO, isValid } from "date-fns"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { totalBeadCount } from "@/lib/utils"

interface PatternCardProps {
  id: string
  title: string
  authorName: string | null
  beadStats: Record<string, number>
  createdAt: string
  thumbPng: string
}

export function PatternCard({ id, title, authorName, beadStats, createdAt, thumbPng }: PatternCardProps) {
  const totalBeads = totalBeadCount(beadStats)
  const date = parseISO(createdAt)
  const relativeDate = isValid(date) ? formatDistanceToNow(date, { addSuffix: true }) : ""

  return (
    <Link href={`/patterns/${id}`} className="block">
      <Card>
        {thumbPng ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/png;base64,${thumbPng}`}
            alt={title}
            className="block w-full bg-muted"
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
          <p className="text-xs text-muted-foreground">
            {totalBeads.toLocaleString()} beads
            <span aria-hidden="true"> · </span>
            {relativeDate}
          </p>
        </CardHeader>
      </Card>
    </Link>
  )
}
