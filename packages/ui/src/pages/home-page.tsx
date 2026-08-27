"use client"

import type { LucideIcon } from "lucide-react"
import { Button } from "../components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Logo } from "../components/logo"

/** One feature card: icon + localized copy, supplied by the host. */
export interface HomeFeature {
  icon: LucideIcon
  title: string
  description: string
}

/**
 * Shared landing page (web `/` + desktop `/`): top bar, hero with the two
 * primary navigation buttons, and a feature-card grid. Pure presentation —
 * copy, icons, and navigation callbacks are all injected by the host, so web
 * (server wrapper + router push) and desktop (useI18n + react-router) share
 * one component.
 */
export interface HomePageProps {
  title: string
  tagline: string
  heroTitle: string
  heroDescription: string
  openEditorLabel: string
  browsePatternsLabel: string
  features: HomeFeature[]
  onOpenEditor: () => void
  onBrowsePatterns: () => void
}

export function HomePage({
  title,
  tagline,
  heroTitle,
  heroDescription,
  openEditorLabel,
  browsePatternsLabel,
  features,
  onOpenEditor,
  onBrowsePatterns,
}: HomePageProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col border">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <h1 className="text-sm font-semibold">{title}</h1>
          <p className="text-[10px] text-muted-foreground">{tagline}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <section className="flex flex-col items-center justify-center px-4 py-20 text-center">
            <Logo className="h-24 w-auto" />
            <h2 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">
              {heroTitle}
            </h2>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">{heroDescription}</p>
            <div className="mt-8 flex items-center gap-3">
              <Button size="lg" onClick={onOpenEditor}>
                {openEditorLabel}
              </Button>
              <Button variant="outline" size="lg" onClick={onBrowsePatterns}>
                {browsePatternsLabel}
              </Button>
            </div>
          </section>

          <section className="border-t bg-muted/30">
            <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({ icon: Icon, title: featureTitle, description }) => (
                <Card key={featureTitle}>
                  <CardHeader>
                    <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                    <CardTitle className="text-sm">{featureTitle}</CardTitle>
                    <CardDescription className="text-xs">{description}</CardDescription>
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
