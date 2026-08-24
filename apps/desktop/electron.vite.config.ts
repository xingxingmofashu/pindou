import { cpSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { defineConfig, externalizeDepsPlugin } from "electron-vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import type { Plugin } from "vite"

/**
 * Copies the Drizzle migration SQL files into the main bundle so the runtime
 * migrator can apply them (`migrate(db, { migrationsFolder })`). electron-vite
 * has no publicDir for the main process, so a small plugin does the copy after
 * each main build.
 */
function copyMigrations(): Plugin {
  return {
    name: "copy-drizzle-migrations",
    closeBundle() {
      const src = resolve(__dirname, "drizzle")
      if (!existsSync(src)) return
      cpSync(src, resolve(__dirname, "out/main/drizzle"), { recursive: true })
    },
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyMigrations()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react(), tailwindcss()],
  },
})
