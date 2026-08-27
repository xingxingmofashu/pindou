import { Download, HardDrive, ImageUp, Palette } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { HomePage as SharedHomePage, type HomeFeature } from "@pindou/ui/pages/home-page"
import { useI18n } from "@pindou/core/i18n/client"

/**
 * Desktop home page — thin wrapper around the shared {@link SharedHomePage}:
 * pulls localized copy from the shared dictionary (the desktop variants under
 * `desktop.home.*`) and navigates through the hash router. The "local" feature
 * card replaces the web's "publish with GitHub" one (no community offline).
 */
export default function HomePage() {
  const { t } = useI18n()
  const navigate = useNavigate()

  const features: HomeFeature[] = [
    {
      icon: ImageUp,
      title: t("desktop.home.features.import.title"),
      description: t("desktop.home.features.import.description"),
    },
    {
      icon: Palette,
      title: t("desktop.home.features.palette.title"),
      description: t("desktop.home.features.palette.description"),
    },
    {
      icon: Download,
      title: t("desktop.home.features.export.title"),
      description: t("desktop.home.features.export.description"),
    },
    {
      icon: HardDrive,
      title: t("desktop.home.features.local.title"),
      description: t("desktop.home.features.local.description"),
    },
  ]

  return (
    <SharedHomePage
      title={t("home.title")}
      tagline={t("home.tagline")}
      heroTitle={t("desktop.home.heroTitle")}
      heroDescription={t("desktop.home.heroDescription")}
      openEditorLabel={t("home.openEditor")}
      browsePatternsLabel={t("home.browsePatterns")}
      features={features}
      onOpenEditor={() => navigate("/editor")}
      onBrowsePatterns={() => navigate("/patterns")}
    />
  )
}
