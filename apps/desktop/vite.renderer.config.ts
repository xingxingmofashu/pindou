import { resolve } from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

/**
 * Vite config for the renderer process (Forge `renderer` target).
 *
 * Forge sets the Vite root to the project dir by default; we pin it to
 * `src/renderer` so the existing index.html stays where it is. The shared
 * workspace packages resolve through pnpm's hoisted node_modules.
 *
 * `optimizeDeps.include` forces the Base UI packages (and their CJS
 * dependency `use-sync-external-store`) through Vite's dep pre-bundling.
 * Without this, `@base-ui/utils/store/useStore.mjs` does a named ESM import
 * (`useSyncExternalStore`) straight from the CJS `shim/index.js`, which Vite
 * cannot analyse when serving source files — the named export is reported
 * missing and the app white-screens. esbuild's pre-bundling performs the
 * CJS→ESM interop correctly.
 */
export default defineConfig({
  root: resolve(__dirname, "src/renderer"),
  plugins: [react(), tailwindcss()],
  // Relative asset URLs so the file://-loaded index.html finds them.
  base: "./",
  // Forge's plugin-vite resolves its outDir (`.vite/renderer/main_window`)
  // against the Vite root, which we pin to src/renderer — the production
  // bundle would land in src/renderer/.vite/... and the packaged main process
  // (loading .vite/renderer/main_window/index.html) would find nothing.
  // Pin the output to the project dir with an absolute path.
  build: {
    outDir: resolve(__dirname, ".vite/renderer/main_window"),
  },
  // Forge's plugin-vite sets `resolve.preserveSymlinks: true`, which makes
  // Vite treat every symlink path as a distinct module — the workspace
  // packages (@pindou/ui → @pindou/core) then resolve to duplicate instances
  // (two I18nContexts), and Vite's automatic dep discovery misses the CJS
  // deps that esbuild pre-bundling must interop. Re-enable realpath
  // resolution so modules dedupe and auto-discovery works like plain `vite`.
  resolve: {
    preserveSymlinks: false,
  },
})
