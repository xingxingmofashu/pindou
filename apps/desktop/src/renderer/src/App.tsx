import { useState } from "react"
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"
import { I18nProvider, dictionaries } from "@pindou/core"
import { Toaster } from "@pindou/ui/components/ui/toast"
import { DesktopHeader } from "./components/DesktopHeader"
import { DesktopFooter } from "./components/DesktopFooter"
import { ThemeContext } from "./theme"
import HomePage from "./pages/HomePage"
import PatternsPage from "./pages/PatternsPage"
import PatternDetailPage from "./pages/PatternDetailPage"
import EditorPage from "./pages/EditorPage"

/**
 * Desktop app shell. Mirrors the web site layout: a header (logo + nav +
 * theme toggle) around every page, and a footer on content pages (home,
 * patterns, pattern detail) — the editor is a full-screen workspace like the
 * web's `/editor` route group. Routing is hash-based so it works from the
 * `file://`-ish renderer URL with no server. Pages read their route params and
 * shared context themselves; the shell owns only the theme state.
 */
export default function App() {
  const [isDark, setIsDark] = useState(false)
  const theme = { isDark, toggleDark: () => setIsDark((d) => !d) }

  return (
    <I18nProvider locale="en" messages={dictionaries.en}>
      <ThemeContext.Provider value={theme}>
        <HashRouter>
          <div className={`flex h-full flex-col overflow-hidden bg-background text-foreground ${isDark ? "dark" : ""}`}>
            <div className="h-full p-2">
              <div className="flex h-full min-h-0 flex-col gap-2 border p-2">
                <Routes>
                  {/* Workspace route (editor): header only, no footer. */}
                  <Route
                    element={
                      <>
                        <DesktopHeader />
                        <div className="flex min-h-0 flex-1 flex-col">
                          <Outlet />
                        </div>
                      </>
                    }
                  >
                    <Route path="/editor" element={<EditorPage />} />
                    <Route path="/editor/:id" element={<EditorPage />} />
                  </Route>

                  {/* Content routes: header + footer. */}
                  <Route element={<ContentLayout />}>
                    <Route index element={<HomePage />} />
                    <Route path="/patterns" element={<PatternsPage />} />
                    <Route path="/patterns/:id" element={<PatternDetailPage />} />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </div>
            <Toaster />
          </div>
        </HashRouter>
      </ThemeContext.Provider>
    </I18nProvider>
  )
}

/** Content pages (home / patterns / detail) share the header + footer chrome. */
function ContentLayout() {
  const { pathname } = useLocation()

  return (
    <>
      <DesktopHeader activeSection={pathname.startsWith("/patterns") ? "list" : "home"} />
      <div className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </div>
      <DesktopFooter />
    </>
  )
}
