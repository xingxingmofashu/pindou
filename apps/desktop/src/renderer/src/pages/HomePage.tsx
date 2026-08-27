import { ImageUp, Palette, Download, HardDrive } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useI18n } from "@pindou/core/i18n/client"
import { Button } from "@pindou/ui/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@pindou/ui/components/ui/card"
import { Logo } from "@pindou/ui/components/logo"

/** Desktop home features — import/palette/export mirror the web page, and
 *  "local" replaces the web's publish/share card (no community in the desktop
 *  app). */
const FEATURES = [
  { key: "import", icon: ImageUp },
  { key: "palette", icon: Palette },
  { key: "export", icon: Download },
  { key: "local", icon: HardDrive },
] as const

/**
 * Desktop home page — mirrors the web landing page's structure (top bar, hero,
 * feature cards) and navigates through the hash router.
 */
export default function HomePage() {
  const { t } = useI18n()
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col border">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <h1 className="text-sm font-semibold">{t("home.title")}</h1>
          <p className="text-[10px] text-muted-foreground">{t("home.tagline")}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <section className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <Logo className="h-20 w-auto" />
            <h2 className="mt-6 text-3xl font-semibold tracking-tight">{t("desktop.home.heroTitle")}</h2>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">{t("desktop.home.heroDescription")}</p>
            <div className="mt-6 flex items-center gap-3">
              <Button size="lg" onClick={() => navigate("/editor")}>
                {t("home.openEditor")}
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate("/patterns")}>
                {t("home.browsePatterns")}
              </Button>
            </div>
          </section>

          <section className="border-t bg-muted/30">
            <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ key, icon: Icon }) => (
                <Card key={key}>
                  <CardHeader>
                    <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                    <CardTitle className="text-sm">{t(`desktop.home.features.${key}.title`)}</CardTitle>
                    <CardDescription className="text-xs">
                      {t(`desktop.home.features.${key}.description`)}
                    </CardDescription>
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
