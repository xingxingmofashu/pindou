import type { Metadata } from "next"
import type { ReactNode } from "react"

/** Auth pages are not useful search results and must not be indexed. */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">{children}</div>
  )
}
