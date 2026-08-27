"use client"

import { useRouter } from "next/navigation"
import { Download, ImageUp, Palette, Share2 } from "lucide-react"
import { HomePage, type HomeFeature } from "@pindou/ui/pages/home-page"
import { localizedPath } from "@pindou/core/i18n/config"
import { useI18n } from "@pindou/core/i18n/client"
import type { Messages } from "@pindou/core/i18n/types"

/**
 * Client render of the web landing page. Receives the server-loaded dictionary
 * as props (the server page owns generateMetadata + SSG) and wires the Next.js
 * router for the two navigation buttons.
 */
export function HomeContent({ dict }: { dict: Messages }) {
  const { locale } = useI18n()
  const router = useRouter()

  const features: HomeFeature[] = [
    { icon: ImageUp, ...dict.home.features.import },
    { icon: Palette, ...dict.home.features.palette },
    { icon: Download, ...dict.home.features.export },
    { icon: Share2, ...dict.home.features.share },
  ]

  return (
    <HomePage
      title={dict.home.title}
      tagline={dict.home.tagline}
      heroTitle={dict.home.heroTitle}
      heroDescription={dict.home.heroDescription}
      openEditorLabel={dict.home.openEditor}
      browsePatternsLabel={dict.home.browsePatterns}
      features={features}
      onOpenEditor={() => router.push(localizedPath(locale, "/editor"))}
      onBrowsePatterns={() => router.push(localizedPath(locale, "/patterns"))}
    />
  )
}
