import type { Metadata } from "next"
import { Apple, MonitorDown, ExternalLink } from "lucide-react"
import { Button } from "@pindou/ui/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@pindou/ui/components/ui/card"
import { Logo } from "@pindou/ui/components/logo"
import { GITHUB_URL } from "@pindou/shared/constants"
import { getDictionary, getLocale } from "@/i18n/server"
import { pageMetadata } from "@/lib/server/meta"

/** Version-less release asset names (see the Release Desktop workflow). */
const MAC_DOWNLOAD_URL = `${GITHUB_URL}/releases/latest/download/pindou-desktop-mac-arm64.dmg`
const WIN_DOWNLOAD_URL = `${GITHUB_URL}/releases/latest/download/pindou-desktop-win-x64.exe`

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const dict = await getDictionary()
  return pageMetadata({
    locale,
    path: "/download",
    title: `${dict.download.title} — ${dict.meta.title}`,
    description: dict.download.heroDescription,
  })
}

/**
 * Desktop download page — platform cards (macOS / Windows) with direct
 * installer links and installation notes for the unsigned beta build.
 */
export default async function DownloadPage() {
  const dict = await getDictionary()

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col border">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <h1 className="text-sm font-semibold">{dict.download.title}</h1>
          <p className="text-[10px] text-muted-foreground">{dict.download.tagline}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <section className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <Logo className="h-16 w-auto" />
            <h2 className="mt-6 text-3xl font-semibold tracking-tight">{dict.download.heroTitle}</h2>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">{dict.download.heroDescription}</p>
          </section>

          <section className="mx-auto w-full max-w-4xl px-4 pb-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <Apple className="size-5 text-muted-foreground" aria-hidden="true" />
                  <CardTitle className="text-sm">{dict.download.macOS}</CardTitle>
                  <CardDescription className="text-xs">{dict.download.macChip}</CardDescription>
                  <Button
                    render={<a href={MAC_DOWNLOAD_URL} aria-label={`${dict.download.downloadButton} (${dict.download.macOS})`} />}
                    nativeButton={false}
                    className="mt-2 gap-2"
                  >
                    <MonitorDown className="size-4" aria-hidden="true" />
                    {dict.download.downloadButton}
                  </Button>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <MonitorDown className="size-5 text-muted-foreground" aria-hidden="true" />
                  <CardTitle className="text-sm">{dict.download.windows}</CardTitle>
                  <CardDescription className="text-xs">{dict.download.winChip}</CardDescription>
                  <Button
                    render={<a href={WIN_DOWNLOAD_URL} aria-label={`${dict.download.downloadWinButton} (${dict.download.windows})`} />}
                    nativeButton={false}
                    className="mt-2 gap-2"
                  >
                    <MonitorDown className="size-4" aria-hidden="true" />
                    {dict.download.downloadWinButton}
                  </Button>
                </CardHeader>
              </Card>
            </div>

            <p className="mt-3 text-center text-[10px] text-muted-foreground">{dict.download.sizeNote}</p>

            <section className="mt-10 space-y-4">
              <h3 className="text-sm font-semibold">{dict.download.installTitle}</h3>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xs">{dict.download.macNoteTitle}</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    {dict.download.macNote}
                  </CardDescription>
                  <pre className="mt-2 overflow-x-auto rounded border bg-muted px-3 py-2 text-xs">
                    <code>xattr -cr /Applications/Pindou.app</code>
                  </pre>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xs">{dict.download.winNoteTitle}</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    {dict.download.winNote}
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xs">{dict.download.otherTitle}</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    {dict.download.otherNote}
                  </CardDescription>
                  <Button
                    variant="link"
                    nativeButton={false}
                    render={<a href={`${GITHUB_URL}/releases/latest`} target="_blank" rel="noreferrer" />}
                    className="mt-2 h-auto gap-1 p-0"
                  >
                    {dict.download.browseReleases}
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </Button>
                </CardHeader>
              </Card>
            </section>
          </section>
        </div>
      </div>
    </div>
  )
}
