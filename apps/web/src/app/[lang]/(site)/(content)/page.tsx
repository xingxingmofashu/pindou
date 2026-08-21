import type { Metadata } from "next"
import Link from "next/link"
import { Download, ImageUp, Palette, Share2 } from "lucide-react"
import { Button } from "@pindou/ui/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@pindou/ui/components/ui/card"
import { Logo } from "@pindou/ui/components/logo"
import { localizedPath } from "@pindou/core/i18n/config"
import { getDictionary, getLocale } from "@/i18n/server"
import { pageMetadata } from "@/lib/server/meta"

const FEATURES = [
  { key: "import", icon: ImageUp },
  { key: "palette", icon: Palette },
  { key: "export", icon: Download },
  { key: "share", icon: Share2 },
] as const

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

export default async function HomePage() {
  const locale = await getLocale()
  const dict = await getDictionary()

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col border">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <h1 className="text-sm font-semibold">{dict.home.title}</h1>
          <p className="text-[10px] text-muted-foreground">
            {dict.home.tagline}
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <section className="flex flex-col items-center justify-center px-4 py-20 text-center">
            <Logo className="h-24 w-auto" />
            <h2 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">
              {dict.home.heroTitle}
            </h2>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              {dict.home.heroDescription}
            </p>
            <div className="mt-8 flex items-center gap-3">
              <Button render={<Link href={localizedPath(locale, "/editor")} />} nativeButton={false} size="lg">
                {dict.home.openEditor}
              </Button>
              <Button render={<Link href={localizedPath(locale, "/patterns")} />} variant="outline" nativeButton={false} size="lg">
                {dict.home.browsePatterns}
              </Button>
            </div>
          </section>

          <section className="border-t bg-muted/30">
            <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ key, icon: Icon }) => (
                <Card key={key}>
                  <CardHeader>
                    <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                    <CardTitle className="text-sm">{dict.home.features[key].title}</CardTitle>
                    <CardDescription className="text-xs">{dict.home.features[key].description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
