import { useState } from "react"
import { I18nProvider, dictionaries } from "@pindou/core"
import { PALETTES } from "@pindou/shared/palettes"
import { Toaster } from "@pindou/ui/components/ui/toast"
import PatternList from "./pages/PatternList"
import EditorPage from "./pages/EditorPage"

type View =
  | { name: "list" }
  | { name: "editor"; patternId: string | null }

/**
 * Desktop app shell: switches between the pattern list and the editor. The
 * palette catalog is bundled (no network), and pattern data lives in the local
 * SQLite store behind the preload API.
 */
export default function App() {
  const [view, setView] = useState<View>({ name: "list" })

  return (
    <I18nProvider locale="en" messages={dictionaries.en}>
      <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
        {view.name === "list" ? (
          <PatternList
            brands={PALETTES}
            onOpen={(id) => setView({ name: "editor", patternId: id })}
            onNew={() => setView({ name: "editor", patternId: null })}
          />
        ) : (
          <EditorPage
            key={view.patternId ?? "new"}
            patternId={view.patternId}
            brands={PALETTES}
            onBack={() => setView({ name: "list" })}
          />
        )}
        <Toaster />
      </div>
    </I18nProvider>
  )
}
