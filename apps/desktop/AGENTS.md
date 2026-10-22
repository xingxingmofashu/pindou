# AGENTS.md — `@pindou/desktop`

Guidance for agent sessions working in `apps/desktop`.

## What this app is

The offline Electron editor. It shares the PixiJS canvas + editor logic with the web app through `@pindou/*` (core/ui/shared) but persists patterns locally — no network, no auth, no Neon. Built with **Electron Forge 7 + Vite** (`plugin-vite`), packaged by `@electron-forge/package` / `@electron-forge/make`.

## Layout

```
forge.config.ts         Forge config — packager, makers, plugins, hooks
vite.main.config.ts     Main + preload build (Vite)
vite.renderer.config.ts Renderer build (Vite)
src/
  main/                 Main process: index.ts (window, single-instance lock, SwiftShader),
                        ipc.ts, store.ts (SQLite), save-service.ts, auto-update.ts
  main/db/              SQLite Drizzle schema + migrations
  main/storage/         Local file/blob storage helpers
  preload/              contextBridge API surface (window.pindou)
  renderer/             React UI (Vite) — editor page + local pattern list
  shared/               IPC channel names + payload/API types (ipc.ts)
drizzle/                SQLite schema + migrations
resources/              App icon (icon.icns) + source png
```

## Process split

Main (Node) + preload (contextBridge, `contextIsolation: true`, `sandbox: false`) + renderer (React via Vite). The renderer never touches Node directly — it calls `window.pindou.*`, typed by `PindouApi` in `src/shared/ipc.ts`; preload forwards each call with `ipcRenderer.invoke`/`send` to the main process.

`src/shared/ipc.ts` is the single cross-process contract: the `IPC` channel map, `PatternMeta` / `PatternRecord` / `CreatePatternInput` / `UpdatePatternInput` / `PatternListResult`, and `PindouApi`. Keep new channels and payload types there — no `types.ts` files.

## Local persistence

Patterns are saved to a local SQLite DB (`better-sqlite3` + Drizzle) in `main/store.ts`, not to Neon Postgres. The app is offline-first. The `patterns` row mirrors the web schema where possible; `grid` JSON and thumbnails live on disk via `main/storage/` (`GridStorage` / `ThumbnailStorage`), so the DB row stores only the object key/path.

## Native module packaging (fragile)

Under pnpm's hoisted layout, `better-sqlite3` + `sharp` live in the workspace-root `node_modules`, not `apps/desktop/node_modules`. `forge.config.ts` has a `packageAfterCopy` hook (`copyClosure`) that copies them with their transitive + platform-optional dependency closure (sharp → `@img/sharp-darwin-arm64` → `@img/sharp-libvips-darwin-arm64`).

- `prune: false` is required (symlinked node_modules would break).
- `asar.unpack: "**/*.{node,dylib}"` unpacks native binaries + dylibs so `dlopen` works.
- Any new native dependency must be added to both the `copyClosure` list and `rebuildConfig.onlyModules`.

## Build output paths

`vite.renderer.config.ts` sets `build.outDir` to an absolute path (`resolve(__dirname, ".vite/renderer/main_window")`) — the production renderer is loaded from `.vite/renderer/main_window/index.html` via `win.loadFile`. Do not change it to a relative path or packaged builds break.

## Drizzle migrations in asar

Production reads migrations from `join(app.getAppPath(), "drizzle")` (inside the asar), **not** `process.resourcesPath`. The `packageAfterCopy` hook copies `drizzle/` into the packaged app.

## Releases

Tagging `v*` triggers `.github/workflows/release-desktop.yml` — builds macOS (arm64, `macos-latest`) + Windows (x64, `windows-latest`), uploads dmg/zip/exe + squirrel `RELEASES`/`*.nupkg`, and creates a non-prerelease GitHub Release. Asset names are version-less: `pindou-desktop-mac-arm64.dmg` / `pindou-desktop-win-x64.exe`. (`macos-13` was dropped — GitHub retired the Intel runners.)

## Auto-update

Prompt-only: the app is **not code-signed** (beta), so Electron's autoUpdater / Squirrel.Mac cannot download updates (it rejects the adhoc signature). `auto-update.ts` queries `update.electronjs.org` on launch, shows a localized (zh/en by `app.getLocale()`) dialog, and opens the GitHub Releases page on accept. Users install manually (and must `xattr -cr /Applications/Pindou.app` if macOS reports the app as damaged).

## Window

Frameless (`frame: false`) with in-app window controls via IPC. `app.commandLine.appendSwitch("enable-unsafe-swiftshader")` so PixiJS WebGL works without GPU acceleration. The single-instance lock lives in `main/index.ts`.

## Commands

Run from the repo root:

```bash
pnpm desktop:dev       # electron-forge start
pnpm desktop:package   # package
pnpm desktop:make      # make (out/make)
```

Typecheck (main + node config):

```bash
pnpm --filter @pindou/desktop typecheck
```

## Constraints

- Offline-first: do not add network/auth dependencies for pattern storage.
- The renderer must only reach Node through `window.pindou` (preload); keep `contextIsolation: true`.
- Keep the cross-process types/channels in `src/shared/ipc.ts`.
- Shared UI stays in `@pindou/ui`; do not fork editor components into the app.
