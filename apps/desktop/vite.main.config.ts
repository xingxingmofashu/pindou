import { defineConfig } from "vite"

/**
 * Vite config for the Electron main + preload processes (Forge `main` and
 * `preload` targets).
 *
 * Only native modules are externalized — they cannot be bundled and are
 * copied into the packaged app by forge.config.ts's `packageAfterPrune` hook.
 * Everything else (drizzle-orm, @pindou/*) is bundled into out/main/main.js
 * and out/main/preload.js.
 */
export default defineConfig({
  build: {
    rollupOptions: {
      external: ["electron", "better-sqlite3", "sharp", "electron-squirrel-startup"],
    },
  },
})
