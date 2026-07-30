import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"

interface PatternCardProps {
  id: string
  title: string
  authorName: string | null
  beadStats: Record<string, number>
  createdAt: string
  thumbPng: string
}

export function PatternCard({ id, title, authorName, beadStats, createdAt, thumbPng }: PatternCardProps) {
  const totalBeads = Object.values(beadStats).reduce((a, b) => a + b, 0)

  return (
    <Link href={`/pattern/${id}`} className="block">
      <Card>
        {thumbPng ? (
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
            {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
          </p>
        </CardHeader>
      </Card>
    </Link>
  )
}
