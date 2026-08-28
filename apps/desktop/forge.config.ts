import type { ForgeConfig } from "@electron-forge/shared-types"
import { cp, mkdir, readFile, realpath, rename, stat } from "node:fs/promises"
import { basename, dirname, join, resolve } from "node:path"

/**
 * Electron Forge configuration.
 *
 * Build: `@electron-forge/plugin-vite` compiles main/preload/renderer (see
 * vite.main.config.ts + vite.renderer.config.ts).
 * Native modules: `plugin-auto-unpack-natives` unpacks `.node` binaries from
 * the asar. Under pnpm's hoisted layout the native modules live in the root
 * node_modules, not `apps/desktop/node_modules`, so `packageAfterPrune`
 * copies `better-sqlite3` and `sharp` (with their dependency closure) into
 * the packaged app. `packageAfterCopy` copies the drizzle migrations, which
 * are not part of the Vite build.
 * Makers: dmg (mac), squirrel (win), deb + rpm (linux).
 */
const config: ForgeConfig = {
  packagerConfig: {
    // Native `.node` binaries are unpacked by plugin-auto-unpack-natives
    // (`**/*.node`). sharp's libvips runtime is a `.dylib` (macOS) or `.dll`
    // (Windows) that the unpacked .node dlopens at runtime — it must live on
    // disk too, so unpack shared libraries as well.
    asar: {
      unpack: "**/*.{node,dylib,dll}",
    },
    name: "Pindou",
    appBundleId: "com.pindou.desktop",
    // App icon (icns generated from apps/web/public/icon-512.png). Electron
    // picks up the .icns for mac; Windows falls back to the default icon
    // unless a .ico is provided alongside.
    icon: resolve(__dirname, "resources/icon.icns"),
    // pnpm hoisted: apps/desktop/node_modules holds only symlinks; prune would
    // resolve them against the store and produce a broken tree in the app.
    prune: false,
    // Offline packaging: reuse the cached Electron zip in
    // ~/Library/Caches/electron instead of fetching its checksum from
    // GitHub (which times out on restricted networks).
    download: {
      unsafelyDisableChecksums: true,
    },
    // plugin-vite would ignore everything but `/.vite`. We keep the vite
    // output, drizzle migrations, and the native-module node_modules that the
    // packageAfterPrune hook materialises; the @pindou/* workspace symlinks
    // are excluded (asar cannot follow out-of-package links, and the main
    // bundle already inlines those packages).
    ignore: (file) => {
      if (!file) return false
      if (file.startsWith("/.vite")) return false
      if (file.startsWith("/drizzle")) return false
      if (file === "/package.json") return false
      if (file.startsWith("/node_modules")) {
        // Keep real (non-symlinked) native modules; drop @pindou/* symlinks
        // and other hoisted leftovers.
        return file.startsWith("/node_modules/@pindou")
      }
      return true
    },
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
      config: {
        // The package name is scoped (@pindou/desktop); squirrel would write
        // the nuspec into a `@pindou\desktop.nuspec` path and fail with ENOENT.
        // Give it an explicit unscoped app name.
        name: "Pindou",
        // NuGet rejects a nuspec without an authors field.
        authors: "xingxingmofashu",
      },
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
      config: {
        // DMG volume icon (same icns as the app bundle).
        icon: resolve(__dirname, "resources/icon.icns"),
        // Version-less asset name, e.g. pindou-desktop-mac-arm64.dmg.
        // This also becomes the DMG volume name.
        name: `pindou-desktop-mac-${process.arch}`,
      },
    },
  ],
  // GitHub Releases publisher — `pnpm --filter @pindou/desktop publish`
  // uploads the make artifacts as a prerelease draft. Requires GITHUB_TOKEN.
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "xingxingmofashu",
          name: "pindou",
        },
        prerelease: true,
        draft: true,
      },
    },
  ],
  hooks: {
    /**
     * Copy the Drizzle migration SQL files and the native modules into the
     * packaged app. packageAfterPrune would be the natural place for the
     * latter, but @electron/packager only fires afterPrune when `prune` is
     * enabled — with pnpm's hoisted layout we must keep `prune: false` (the
     * app's node_modules holds symlinks). So both copies run here, after
     * packager's copy step and before asar packing.
     */
    packageAfterCopy: async (_config, buildPath) => {
      try {
        // Drizzle migrations are not part of the Vite build.
        const src = resolve(__dirname, "drizzle")
        await cp(src, join(buildPath, "drizzle"), { recursive: true })
        // pnpm hoisted keeps native modules in the workspace-root node_modules,
        // so packager (copying apps/desktop) never sees them. Copy the real,
        // dereferenced modules with their transitive runtime closure.
        const nm = join(buildPath, "node_modules")
        const rootNm = resolve(__dirname, "../../node_modules")
        for (const name of ["better-sqlite3", "sharp"]) {
          await copyClosure(name, join(rootNm, name), nm)
        }
      } catch (err) {
        console.error("forge packageAfterCopy failed:", err)
        throw err
      }
    },
    /**
     * maker-zip hardcodes the archive name as `<dir>-<version>.zip` with no
     * way to customise it. Rename it to the version-less
     * `pindou-desktop-mac-<arch>.zip` so every published asset follows the
     * same convention as the dmg/exe.
     */
    postMake: async (_config, results) => {
      const renamed: typeof results = []
      for (const result of results) {
        const artifacts: string[] = []
        for (const artifact of result.artifacts) {
          const name = basename(artifact)
          const zipMatch = name.match(/^(.+)-[0-9]+\.[0-9]+\.[0-9]+[^/]*\.zip$/)
          if (zipMatch) {
            const newPath = join(dirname(artifact), `pindou-desktop-mac-${process.arch}.zip`)
            await rename(artifact, newPath)
            artifacts.push(newPath)
          } else {
            artifacts.push(artifact)
          }
        }
        renamed.push({ ...result, artifacts })
      }
      return renamed
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

  const pkgJson = join(srcDir, "package.json")
  const raw = await readFile(pkgJson, "utf8").catch(() => null)
  if (!raw) return
  const pkg = JSON.parse(raw)
  const deps = pkg.dependencies
  if (deps) {
    // Resolve each transitive dep from the SOURCE tree (the hoisted root
    // node_modules / pnpm store), where the deps actually live — the copied
    // target has no node_modules to walk up through yet.
    for (const dep of Object.keys(deps)) {
      const resolved = await resolveFrom(dep, srcDir)
      if (resolved) await copyClosure(dep, resolved, destNm, seen)
    }
  }
  // sharp ships platform binaries as optionalDependencies; copy only the ones
  // matching the current platform+arch (e.g. @img/sharp-darwin-arm64 and
  // @img/sharp-libvips-darwin-arm64). The @img/sharp-* platform packages
  // themselves also declare the libvips runtime as an optional dependency,
  // so recurse into those too.
  const optionalDeps = pkg.optionalDependencies
  if (optionalDeps && (pkgName === "sharp" || pkgName.startsWith("@img/sharp"))) {
    for (const dep of Object.keys(optionalDeps)) {
      if (dep.includes(`-${process.platform}-${process.arch}`)) {
        const resolved = await resolveFrom(dep, srcDir)
        if (resolved) await copyClosure(dep, resolved, destNm, seen)
      }
    }
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
