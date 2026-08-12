"use client"

import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { localizedPath, type Locale } from "@/i18n/config"

interface PatternSearchProps {
  locale: Locale
  initialQuery: string
  placeholder: string
  ariaLabel: string
}

/**
 * Search box for the patterns catalog. Submits via `router.push` so the server
 * component re-renders through a soft navigation instead of a full page load
 * while the URL gains `?q=`.
 *
 * `key` pins the input's value to the URL's `q` — when navigation changes the
 * query (submit, or the "Clear search" link) the input remounts with the new
 * default rather than keeping stale text.
 */
export function PatternSearch({ locale, initialQuery, placeholder, ariaLabel }: PatternSearchProps) {
  const router = useRouter()

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const input = new FormData(e.currentTarget).get("q")
        const q = typeof input === "string" ? input.trim() : ""
        router.push(localizedPath(locale, q ? `/patterns?q=${encodeURIComponent(q)}` : "/patterns"))
      }}
    >
      <div className="relative">
        <Input
          key={initialQuery}
          name="q"
          defaultValue={initialQuery}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="h-8 w-40 pr-8 sm:w-48"
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label={ariaLabel}
          className="absolute right-0 top-0 text-muted-foreground hover:text-foreground"
        >
          <Search />
        </Button>
      </div>
    </form>
  )
}
