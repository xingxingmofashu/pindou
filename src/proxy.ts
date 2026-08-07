import { NextResponse, type NextRequest } from "next/server"
import { detectLocale, isLocale } from "@/i18n/config"

/**
 * Locale-aware routing proxy: prefixes every page request with the detected
 * locale (`/editor` → `/en/editor`, `/` → `/en` or `/zh`). Requests that
 * already carry a locale segment pass through untouched. API routes, Next
 * internals, and static assets with extensions are excluded via the matcher.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const [segment] = pathname.split("/").filter(Boolean)

  if (segment && isLocale(segment)) return

  const locale = detectLocale(request.headers.get("accept-language"))
  request.nextUrl.pathname = `/${locale}${pathname}`
  return NextResponse.redirect(request.nextUrl)
}

export const config = {
  matcher: ["/((?!_next|api|favicon\\.ico|.*\\..*).*)"],
}
