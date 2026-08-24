import { useState } from "react"
import { Moon, Sun } from "lucide-react"
import { I18nProvider, dictionaries } from "@pindou/core"
import { PALETTES } from "@pindou/shared/palettes"
import { GITHUB_URL } from "@pindou/shared/constants"
import { Toaster } from "@pindou/ui/components/ui/toast"
import { Button } from "@pindou/ui/components/ui/button"
import { Separator } from "@pindou/ui/components/ui/separator"
import { Logo } from "@pindou/ui/components/logo"
import { useI18n } from "@pindou/core/i18n/client"
import HomePage from "./pages/HomePage"
import PatternList from "./pages/PatternList"
import PatternDetailPage from "./pages/PatternDetailPage"
import EditorPage from "./pages/EditorPage"

type View =
  | { name: "home" }
  | { name: "list" }
  | { name: "detail"; patternId: string }
  | { name: "editor"; patternId: string | null }

/**
 * Desktop app shell. Mirrors the web site layout: a header (logo + nav +
 * theme toggle) around every page, and a footer on content pages (home,
 * patterns, pattern detail) — the editor is a full-screen workspace like the
 * web's `/editor` route group. The palette catalog is bundled (no network),
 * and pattern data lives in the local SQLite store behind the preload API.
 */
export default function App() {
  const [view, setView] = useState<View>({ name: "home" })
  const [isDark, setIsDark] = useState(false)

  const isWorkspace = view.name === "editor"

  return (
    <I18nProvider locale="en" messages={dictionaries.en}>
      <div className={`flex h-full flex-col overflow-hidden bg-background text-foreground ${isDark ? "dark" : ""}`}>
        <div className="h-full p-2">
          <div className="flex h-full min-h-0 flex-col gap-2 border p-2">
            <DesktopHeader
              isDark={isDark}
              onToggleDark={() => setIsDark((d) => !d)}
              onHome={() => setView({ name: "home" })}
              onPatterns={() => setView({ name: "list" })}
              onEditor={() => setView({ name: "editor", patternId: null })}
              activeSection={view.name === "detail" ? "list" : view.name}
            />
            <div className="flex min-h-0 flex-1 flex-col">
              {view.name === "home" && (
                <HomePage
                  onOpenEditor={() => setView({ name: "editor", patternId: null })}
                  onBrowsePatterns={() => setView({ name: "list" })}
                />
              )}
              {view.name === "list" && (
                <PatternList
                  brands={PALETTES}
                  onOpen={(id) => setView({ name: "detail", patternId: id })}
                  onNew={() => setView({ name: "editor", patternId: null })}
                />
              )}
              {view.name === "detail" && (
                <PatternDetailPage
                  patternId={view.patternId}
                  brands={PALETTES}
                  isDark={isDark}
                  onEdit={(id) => setView({ name: "editor", patternId: id })}
                  onBack={() => setView({ name: "list" })}
                />
              )}
              {view.name === "editor" && (
                <EditorPage
                  key={view.patternId ?? "new"}
                  patternId={view.patternId}
                  brands={PALETTES}
                  isDark={isDark}
                />
              )}
            </div>
            {!isWorkspace && (
              <DesktopFooter
                onPatterns={() => setView({ name: "list" })}
                onEditor={() => setView({ name: "editor", patternId: null })}
              />
            )}
          </div>
        </div>
        <Toaster />
      </div>
    </I18nProvider>
  )
}

/** Top navigation bar — mirrors the web header (logo + nav + theme toggle),
 *  minus the auth area (the desktop app has no sign-in). */
function DesktopHeader({
  isDark,
  onToggleDark,
  onHome,
  onPatterns,
  onEditor,
  activeSection,
}: {
  isDark: boolean
  onToggleDark: () => void
  onHome: () => void
  onPatterns: () => void
  onEditor: () => void
  activeSection: "home" | "list" | "editor"
}) {
  const { t } = useI18n()

  return (
    <header className="flex items-center justify-between border px-3 py-2">
      <div className="flex items-center gap-4">
        <button type="button" className="flex items-center" aria-label={t("header.homeAria")} onClick={onHome}>
          <Logo className="h-5 w-24" />
        </button>
        <Separator orientation="vertical" className="mx-1 h-8" />
        <nav className="flex items-center gap-1">
          <Button
            variant={activeSection === "list" ? "secondary" : "link"}
            size="sm"
            onClick={onPatterns}
          >
            {t("header.patterns")}
          </Button>
          <Button
            variant={activeSection === "editor" ? "secondary" : "link"}
            size="sm"
            onClick={onEditor}
          >
            {t("header.editor")}
          </Button>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <Button
          render={
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label={t("header.githubAria")} />
          }
          variant="link"
          size="sm"
        >
          {t("header.github")}
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={t("header.toggleTheme")} onClick={onToggleDark}>
          <Sun className={isDark ? "hidden" : undefined} />
          <Moon className={isDark ? undefined : "hidden"} />
        </Button>
      </div>
    </header>
  )
}

/** Footer — mirrors the web footer (logo + tagline, nav, copyright). */
function DesktopFooter({
  onPatterns,
  onEditor,
}: {
  onPatterns: () => void
  onEditor: () => void
}) {
  const { t } = useI18n()
  const year = new Date().getFullYear()

  return (
    <footer className="border px-3 py-3">
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <div className="flex items-center gap-2">
          <Logo className="h-4 w-20" />
          <span className="text-xs text-muted-foreground">{t("footer.tagline")}</span>
        </div>

        <nav className="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Footer">
          <button type="button" className="hover:text-foreground" onClick={onPatterns}>
            {t("header.patterns")}
          </button>
          <button type="button" className="hover:text-foreground" onClick={onEditor}>
            {t("header.editor")}
          </button>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
            aria-label={t("header.githubAria")}
          >
            {t("header.github")}
          </a>
        </nav>

        <p className="text-xs text-muted-foreground">
          {t("footer.rights").replace("{year}", String(year))}
        </p>
      </div>
    </footer>
  )
}
