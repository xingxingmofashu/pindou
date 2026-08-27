import type { Metadata } from "next"
import { getDictionary, getLocale } from "@/i18n/server"
import { pageMetadata } from "@/lib/server/meta"
import { HomeContent } from "./home-content"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const dict = await getDictionary()
  return pageMetadata({
    locale,
    path: "/",
    title: dict.meta.title,
    description: dict.meta.description,
  })
}

/**
 * Server wrapper for the web landing page: loads the localized dictionary and
 * renders the shared client {@link HomeContent}. Keeps generateMetadata + SSG.
 */
export default async function HomePage() {
  const dict = await getDictionary()
  return <HomeContent dict={dict} />
}
