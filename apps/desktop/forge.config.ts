import type { ForgeConfig } from "@electron-forge/shared-types"
import { cp, mkdir, readFile, realpath, stat } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"

/**
 * Electron Forge configuration.
 *
 * Build: `@electron-forge/plugin-vite` compiles main/preload/renderer (see
 * vite.main.config.ts + vite.renderer.config.ts).
 * Native modules: `plugin-auto-unpack-natives` unpacks `.node` binaries from
 * the asar; the `packageAfterPrune` hook then copies `better-sqlite3` and
 * `sharp` (with their full dependency closure) from the pnpm store into the
 * packaged app — pnpm's isolated symlink layout means @electron/packager
 * cannot resolve them by itself.
 * Makers: dmg (mac), squirrel (win), deb + rpm (linux).
 */
const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: "Pindou",
    appBundleId: "com.pindou.desktop",
    // pnpm workspace: the app's node_modules only holds symlinks into the
    // root .pnpm store, so skip @electron/packager's prune step entirely —
    // the hook below rebuilds node_modules with the real closure instead.
    prune: false,
  },
  rebuildConfig: {
    // Only rebuild the native modules we ship; everything else is bundled JS.
    onlyModules: ["better-sqlite3", "sharp"],
  },
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    {
      name: "@electron-forge/plugin-vite",
      config: {
        build: [
          {
            entry: { main: "src/main/index.ts" },
            config: "vite.main.config.ts",
            target: "main",
          },
          {
            entry: { preload: "src/preload/index.ts" },
            config: "vite.main.config.ts",
            target: "preload",
          },
        ],
        renderer: [
          {
            name: "main_window",
            config: "vite.renderer.config.ts",
          },
        ],
      },
    },
  ],
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {},
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
      config: {},
    },
    {
      name: "@electron-forge/maker-deb",
      config: {},
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {},
    },
    {
      name: "@electron-forge/maker-dmg",
      config: {},
    },
  ],
  hooks: {
    /**
     * Copy the Drizzle migration SQL files into the packaged app so the
     * runtime migrator can apply them (`migrate(db, { migrationsFolder })`).
     * Forge's plugin-vite emits the main bundle to out/main, but the
     * `drizzle/` directory is not part of the Vite build.
     */
    packageAfterCopy: async (_config, buildPath) => {
      const src = resolve(__dirname, "drizzle")
      const dest = join(buildPath, "drizzle")
      await cp(src, dest, { recursive: true })
    },
    /**
     * pnpm installs workspace dependencies as symlinks into the root
     * `.pnpm` store. @electron/packager (with `prune: false`) copies those
     * symlinks verbatim, so the packaged app's node_modules would point at
     * paths that don't exist on the user's machine. This hook replaces the
     * symlinked native modules with their real, dereferenced files — the
     * full dependency closure, not just the top-level packages.
     */
    packageAfterPrune: async (_config, buildPath) => {
      const nm = join(buildPath, "node_modules")
      const rootNm = resolve(__dirname, "../../node_modules")
      for (const name of ["better-sqlite3", "sharp"]) {
        await copyClosure(name, join(rootNm, name), nm)
      }
    },
  },
}

/**
 * Recursively copy `pkg` (dereferencing pnpm symlinks) plus its transitive
 * runtime dependencies into the packaged app's node_modules.
 */
async function copyClosure(
  pkgName: string,
  srcDir: string,
  destNm: string,
  seen = new Set<string>(),
): Promise<void> {
  if (seen.has(pkgName)) return
  seen.add(pkgName)

  const dest = join(destNm, pkgName)
  await mkdir(dirname(dest), { recursive: true })
  await cp(srcDir, dest, { recursive: true, dereference: true })

  const pkgJson = join(dest, "package.json")
  const raw = await readFile(pkgJson, "utf8").catch(() => null)
  if (!raw) return
  const deps = JSON.parse(raw).dependencies
  if (!deps) return

  // Resolve each transitive dep the same way Node would, walking up from the
  // copied package's directory (whose symlinks still point into the store).
  for (const dep of Object.keys(deps)) {
    const resolved = await resolveFrom(dep, dest)
    if (resolved) await copyClosure(dep, resolved, destNm, seen)
  }
}

/** Walk up from `fromDir` resolving `dep` via node_modules, following pnpm
 *  symlinks to their real store path. Returns null when not found. */
async function resolveFrom(dep: string, fromDir: string): Promise<string | null> {
  let dir = fromDir
  for (;;) {
    const candidate = join(dir, "node_modules", dep)
    try {
      const st = await stat(candidate)
      if (st.isDirectory()) return candidate
      const real = await realpath(candidate)
      const rst = await stat(real)
      if (rst.isDirectory()) return real
    } catch {
      /* fall through */
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export default config
