import { useState } from "react"
import { I18nProvider, dictionaries } from "@pindou/core"
import { PALETTES } from "@pindou/shared/palettes"
import { Toaster } from "@pindou/ui/components/ui/toast"
import { DesktopHeader } from "./components/DesktopHeader"
import { DesktopFooter } from "./components/DesktopFooter"
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
  const openEditor = () => setView({ name: "editor", patternId: null })

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
              onEditor={openEditor}
              activeSection={view.name === "detail" ? "list" : view.name}
            />
            <div className="flex min-h-0 flex-1 flex-col">
              {view.name === "home" && (
                <HomePage
                  onOpenEditor={openEditor}
                  onBrowsePatterns={() => setView({ name: "list" })}
                />
              )}
              {view.name === "list" && (
                <PatternList
                  brands={PALETTES}
                  onOpen={(id) => setView({ name: "detail", patternId: id })}
                  onNew={openEditor}
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
                onEditor={openEditor}
              />
            )}
          </div>
        </div>
        <Toaster />
      </div>
    </I18nProvider>
  )
}
