import { NextResponse, type NextRequest } from "next/server"
import { detectLocale, locales } from "@/i18n/config"

/**
 * Locale-aware routing proxy: prefixes every page request with the detected
 * locale (`/editor` → `/en/editor`, `/` → `/en` or `/zh`). API routes, Next
 * internals, and static assets with extensions are excluded via the matcher.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) {
    return
  }

  const locale = detectLocale(request.headers.get("accept-language"))
  request.nextUrl.pathname = `/${locale}${pathname}`
  return NextResponse.redirect(request.nextUrl)
}

export const config = {
  matcher: ["/((?!_next|api|favicon\\.ico|.*\\..*).*)"],
}
