import { useEffect, useState } from "react"
import { Minus, Square, Copy, X } from "lucide-react"

/**
 * Frameless-window controls (minimize / maximize-restore / close) for the
 * custom title bar. Double-clicking the bar toggles maximize like a native
 * title bar would.
 */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => window.pindou.window.onMaximized(setMaximized), [])

  return (
    <div className="no-drag flex items-center">
      <button
        type="button"
        className="flex h-8 w-11 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Minimize"
        onClick={() => window.pindou.window.minimize()}
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="flex h-8 w-11 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={maximized ? "Restore" : "Maximize"}
        onClick={() => window.pindou.window.toggleMaximize()}
      >
        {maximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        className="flex h-8 w-11 items-center justify-center text-muted-foreground hover:bg-red-500 hover:text-white"
        aria-label="Close"
        onClick={() => window.pindou.window.close()}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
