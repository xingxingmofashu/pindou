import Link from "next/link"
import { Logo } from "@/components/logo"

export default function HomePage() {
  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <Logo className="h-20 w-auto" />
        <p className="mt-4 max-w-md text-base text-muted-foreground">
          Fuse bead pattern editor and community. Create, share, and discover
          Perler bead patterns — no account needed.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link
            href="/editor"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open Editor
          </Link>
          <Link
            href="/patterns"
            className="inline-flex h-10 items-center justify-center rounded-md border px-6 text-sm font-medium hover:bg-accent"
          >
            View All
          </Link>
        </div>
      </section>
    </div>
  )
}
