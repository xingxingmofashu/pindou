<p align="center">
  <img src="apps/web/public/lockup.svg" alt="PINDOU" width="280" />
</p>
<p align="center">Fuse bead pattern editor and community.</p>
<p align="center">
  <a href="https://github.com/xingxingmofashu/pindou/actions/workflows/ci.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/xingxingmofashu/pindou/ci.yml?style=flat-square&branch=main" /></a>
  <a href="https://github.com/xingxingmofashu/pindou"><img alt="GitHub stars" src="https://img.shields.io/github/stars/xingxingmofashu/pindou?style=flat-square" /></a>
  <a href="https://github.com/xingxingmofashu/pindou"><img alt="License" src="https://img.shields.io/github/license/xingxingmofashu/pindou?style=flat-square" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a>
</p>

---

Create pixel-art patterns, sign in with GitHub, and share them with the world.

**Live:** [xingxing-pindou.vercel.app](https://xingxing-pindou.vercel.app) (Vercel) · [xingxing-pindou.netlify.app](https://xingxing-pindou.netlify.app) (Netlify — accessible from mainland China)

<p align="center">
  <img src=".github/assets/en/preview.png" alt="Pindou pattern editor preview" width="800" />
</p>

## Features

- **Canvas editor** — WebGL-powered (PixiJS v8) with an infinite sparse grid, cursor-centred zoom, pan, and pen / eraser / fill tools
- **Fixed grid resolution** — grid lines and beads always render at data-cell resolution, so an imported pattern keeps its exact cell count at any zoom (LOD only controls paint-brush block size)
- **Image to pattern** — convert any image into a bead pattern in your browser (Web Worker + canvas, perceptual OKLab colour matching); Photo / Illustration modes, merge similar colours, remove background, and exclude specific colours from the conversion
- **Live bead usage** — the editor shows the painted grid size, total beads, and per-colour counts that update as you draw
- **Export PNG chart** — download the pattern as a printable chart with coordinates, optional colour-code labels, and a scaled bead-usage list
- **Multi-brand palettes** — MARD (漫漫), Perler, Hama, Artkal with switchable series
- **GitHub sign-in** — publish patterns with your GitHub identity (Better Auth), no separate account or username needed
- **Pattern gallery** — browse recently published patterns with thumbnail previews
- **Detail view** — interactive read-only canvas on each pattern page, editable by the author
- **Desktop app** — an offline Electron editor (macOS + Windows) with the same canvas, SQLite storage, and update prompts via GitHub Releases

## Tech Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) |
| Canvas | PixiJS v8 (WebGL) |
| Styling | Tailwind CSS v4 + shadcn/ui (Base UI) |
| Database | PostgreSQL (Neon) via @neondatabase/serverless + Drizzle ORM |
| Auth | Better Auth (GitHub OAuth) |
| Image conversion | In-browser (Web Worker + canvas, perceptual OKLab) |
| Thumbnails | sharp (server-side, Node runtime) |
| Color math | culori |
| Rate limiting | Upstash Redis (@upstash/ratelimit) |
| Language | TypeScript (strict) |
| Desktop | Electron 37 + Electron Forge 7 (Vite) |

## Getting Started

```bash
# Install dependencies
pnpm install

# Start the dev server (http://localhost:3000)
pnpm dev

# Production build
pnpm build

# Lint
pnpm lint
```

## Project Structure

pnpm monorepo with a strict one-way dependency chain: `@pindou/shared ← @pindou/core ← @pindou/ui ← @pindou/web`.

```
apps/
  web/                  # @pindou/web — Next.js 16 app (the deployable)
    src/
      app/              # App Router routes — server pages fetch data and render a
                        # client.tsx content component, each route with loading.tsx (skeleton)
                        # and error.tsx (error boundary)
        [lang]/         # Locale-prefixed routes (en / zh)
          (site)/       # Main site layout (header + footer chrome)
            (content)/  # Home + pattern gallery + pattern detail
            (workspace)/# Editor + pattern edit pages
          sign-in/      # GitHub sign-in page
        api/            # Better Auth handlers + REST API (patterns, brands)
      components/       # Web-specific components (header, footer, color-palette, providers, ...)
      db/               # Drizzle schema (auth + app tables) + Neon connection
      i18n/             # Server-side dictionary loading (getDictionary)
      lib/              # Web-only helpers: auth, server/{palettes,patterns,meta}, escapeLike
      workers/          # In-browser image decode + pre-scale (transform.worker.ts)
  desktop/              # @pindou/desktop — Electron app (offline editor)
    src/
      main/             # Main process: window, IPC, SQLite store, auto-update
      preload/          # contextBridge API surface
      renderer/         # React UI (Vite)
      shared/           # IPC channel names
    drizzle/            # SQLite schema + migrations
    resources/          # App icon (icns) + icon source
  vercel.json           # Vercel deployment config (Root Directory: apps/web)
  netlify.toml          # Netlify deployment config (Base: apps/web)

packages/
  shared/               # @pindou/shared — pure constants + types (no dependencies)
    src/constants.ts    #   Editor/upload limits, canvas bg
    src/types.ts        #   Row types for the three tables + Palette
  core/                 # @pindou/core — framework-agnostic business logic
    src/editor.ts       #   Pure grid math: LOD, flood fill, serialization, counting
    src/export.ts       #   Client-only PNG chart export (never on the server)
    src/transform.ts    #   Pure image→grid quantization (perceptual OKLab)
    src/date.ts         #   Localized date formatting (date-fns)
    src/utils.ts        #   cn, fetcher, postJson, hexToRgb, bead-count helpers
    src/i18n/           #   Locale config + dictionaries (en/zh) + client I18nProvider
    src/hooks/          #   Zustand stores + PixiJS lifecycle hooks (use-editor, use-pixi-canvas, ...)
    src/server/         #   Node-only infra: r2.ts, grid-storage.ts, rate-limit.ts, thumbnail.ts
  ui/                   # @pindou/ui — component library (Base UI + Tailwind)
    src/components/     #   Shared editor components (pixi-canvas, bead-stats, dialogs, ...)
    src/components/ui/  #   shadcn/ui primitives (never edited manually)
    src/index.css       #   Tailwind entry (tw-animate-css + @layer base)
    src/index.ts        #   Root exports (primitives + branding + utils)
```

Web-specific dependencies (auth, worker, router, theming) are injected into the
shared components as props/hooks, keeping the package graph acyclic — the ui
package never touches Next.js, and core never touches React state.

## Editor

The editor at `/editor` provides:

- **Pen / Eraser / Fill** — paint with the active colour (Bresenham-interpolated drags), erase beads, or flood-fill connected regions
- **Undo / Redo** — step back through your edits (⌘Z / ⇧⌘Z; Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y on Windows/Linux)
- **Show colour codes** — toggle per-bead colour-code labels on the canvas
- **Import from image** — upload an image and convert it into a bead pattern; advanced options include Photo / Illustration modes, merge similar colours, remove background, and excluding colours from the palette
- **Export PNG** — download a printable chart with coordinates, optional colour-code labels, and a bead-usage list
- **Bead usage panel** — a right sidebar showing grid size, total beads, and per-colour counts, updating live as you draw
- **Zoom** — wheel zoom (cursor-centred, 0.5×–20×), percentage input, fit button
- **Pan** — middle- or right-button drag
- **Palette sidebar** — brand switcher, swatches grouped by series
- **Publish** — sign in with GitHub and save the pattern to the gallery with a title and description; your author name comes from your GitHub account

## API

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/patterns?page=1` | List published patterns (paginated) |
| `POST` | `/api/patterns` | Publish a new pattern (GitHub sign-in required, rate limited) |
| `GET` | `/api/patterns/[id]` | Get a single pattern |
| `PATCH` | `/api/patterns/[id]` | Update a pattern's title, description, or grid (author only, rate limited) |
| `GET` | `/api/brands` | List all brands with their colors |
| `GET` | `/api/brands/[id]` | Get a single brand with its colors |

Image-to-pattern conversion happens entirely in the browser (no `/api/transform`); the uploaded image never leaves the client. Publish/edit JSON bodies are capped at 20 MB; grids are bounded to 4096 per side and 1,000,000 total cells. Publish and edit are rate-limited per user (20 requests / 60 s) via Upstash Redis.

## Desktop App

The desktop app (`apps/desktop`) is an offline Electron editor built with Electron Forge + Vite. It shares the PixiJS canvas and editor logic with the web app via the `@pindou/*` packages, and stores patterns locally in SQLite (Drizzle).

### Development

```bash
pnpm desktop:dev        # Run the Electron app in dev mode
pnpm desktop:package    # Package the app (out/Pindou-darwin-arm64/…)
pnpm desktop:make       # Build installers (dmg / exe / zip in out/make)
```

### Releases

Tagging `v*` triggers the `Release Desktop` workflow, which builds macOS (arm64) and Windows (x64) and publishes a GitHub Release:

| Platform | Asset |
|---|---|
| macOS | `pindou-desktop-mac-arm64.dmg` / `.zip` |
| Windows | `pindou-desktop-win-x64.exe` |

The release is not code-signed (beta). If macOS reports the app as damaged after download, run:

```bash
xattr -cr /Applications/Pindou.app
```

On Windows, SmartScreen may warn — click **More info** → **Run anyway**.

### Windows FAQ

**Where is the app installed?**
Squirrel installs per-user (no admin required) to `%LOCALAPPDATA%\pindou-desktop`, not Program Files. A Start Menu shortcut is added automatically.

**Why does SmartScreen warn?**
The installer is not code-signed yet. Click **More info** → **Run anyway** — the app is built from this repository's CI.

**Why does `Updater.exe` run during install / appear in `%LOCALAPPDATA%\SquirrelTemp`?**
That's Squirrel's installer/updater, a normal part of the per-user install. It runs briefly during install/update/uninstall to register shortcuts and finish setup, then exits. It does not download anything and does not run at every app launch.

**How do I update?**
On launch the app checks for a newer release and prompts you (localized zh/en). Accepting opens the GitHub Releases page — download the new `.exe` and run it. Your local patterns are kept.

**How do I uninstall?**
Settings → Apps → Installed apps → find **Pindou** → Uninstall. Pattern data under `%LOCALAPPDATA%\pindou-desktop` may be kept after uninstall.

### Auto-update

On launch the packaged app checks update.electronjs.org for a newer release and prompts the user (localized zh/en). Accepting opens the GitHub Releases page for a manual download — auto-download is intentionally not used because Squirrel.Mac rejects the unsigned build's adhoc signature.

## License

[Apache License 2.0](LICENSE)
