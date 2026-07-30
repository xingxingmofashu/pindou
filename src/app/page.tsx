import { desc } from "drizzle-orm"
import { db } from "@/db"
import { patterns } from "@/db/schema"
import { PatternCard } from "@/components/pattern/card"
import { Logo } from "@/components/logo"
import { parseBeadStats } from "@/lib/utils"

export const revalidate = 60

export default function HomePage() {
  const rows = db
    .select({
      id: patterns.id,
      title: patterns.title,
      authorName: patterns.authorName,
      beadStats: patterns.beadStats,
      thumbPng: patterns.thumbPng,
      createdAt: patterns.createdAt,
    })
    .from(patterns)
    .orderBy(desc(patterns.createdAt))
    .limit(12)
    .all()

  const list = rows.map((r) => ({
    ...r,
    beadStats: parseBeadStats(r.beadStats),
  }))

  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <Logo className="h-20 w-auto" />
        <p className="mt-4 max-w-md text-base text-muted-foreground">
          Fuse bead pattern editor and community. Create, share, and discover
          Perler bead patterns — no account needed.
        </p>
        <a
          href="/editor"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open Editor
        </a>
      </section>

      {/* Patterns grid */}
      {list.length > 0 && (
        <section className="px-4 pb-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-4 text-lg font-semibold">Recent Patterns</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {list.map((p) => (
                <PatternCard key={p.id} {...p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty state */}
      {list.length === 0 && (
        <section className="flex flex-1 items-center justify-center px-4 pb-16">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">No patterns published yet.</p>
            <a
              href="/editor"
              className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
            >
              Create the first one
            </a>
          </div>
        </section>
      )}
    </div>
  )
}
