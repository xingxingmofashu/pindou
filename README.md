<p align="center">
  <img src="public/lockup.svg" alt="PINDOU" width="280" />
</p>
<p align="center">Fuse bead / Perler bead pattern editor and community.</p>
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

## Features

- **Canvas editor** — WebGL-powered (PixiJS v8) with an infinite sparse grid, cursor-centred zoom, pan, and pen / eraser / fill tools
- **Fixed grid resolution** — grid lines and beads always render at data-cell resolution, so an imported pattern keeps its exact cell count at any zoom (LOD only controls paint-brush block size)
- **Image to pattern** — convert any image into a bead pattern with the active brand's palette (server-side sharp + perceptual OKLab colour matching); Photo / Illustration modes, merge similar colours, remove background, and exclude specific colours from the conversion
- **Live bead usage** — the editor shows the painted grid size, total beads, and per-colour counts that update as you draw
- **Export PNG chart** — download the pattern as a printable chart with coordinates, optional colour-code labels, and a scaled bead-usage list
- **Multi-brand palettes** — MARD (漫漫), Perler, Hama, Artkal with switchable series
- **GitHub sign-in** — publish patterns with your GitHub identity (Better Auth), no separate account or username needed
- **Pattern gallery** — browse recently published patterns with thumbnail previews
- **Detail view** — interactive read-only canvas on each pattern page, editable by the author

## Tech Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) |
| Canvas | PixiJS v8 (WebGL) |
| Styling | Tailwind CSS v4 + shadcn/ui (Base UI) |
| Database | PostgreSQL (Neon) via @neondatabase/serverless + Drizzle ORM |
| Auth | Better Auth (GitHub OAuth) |
| Image conversion | sharp (server-side, Node runtime) |
| Color math | culori |
| Language | TypeScript (strict) |

## Getting Started

```bash
# Install dependencies
pnpm install

# Start dev server (http://localhost:3000)
pnpm dev

# Production build
pnpm build

# Lint
pnpm lint
```

## Project Structure

```
src/
  app/                  # Next.js App Router pages
    [lang]/             # Locale-prefixed routes (en / zh)
      (site)/           # Main site layout (header + footer chrome)
        editor/         # Editor page
        patterns/       # Pattern gallery
        patterns/[id]/  # Pattern detail + edit pages
      sign-in/          # GitHub sign-in page
    api/auth/           # Better Auth route handlers
    api/patterns/       # REST API (GET list, POST publish)
    api/patterns/[id]/  # GET single pattern, PATCH update
    api/transform/      # POST image → bead grid conversion (Node runtime)
    api/brands/         # GET palette catalog (all brands + colors)
  components/
    auth/               # GitHubButton, UserMenu (sign-in UI)
    editor/             # ToolBar, ZoomControls, ColorPalette, dialogs, BeadStatsPanel
    pattern/            # PatternCard, detail panel
    pixi-canvas.tsx     # Reusable PixiJS canvas component
    ui/                 # shadcn/ui components (never edited manually)
  hooks/
    use-palette.ts      # Shared active-brand store (Zustand)
    use-pixi-app.ts     # PixiJS Application lifecycle (WebGL context management)
    use-pixi-canvas.ts  # Zoom/pan/draw pointer events, fixed-resolution rebuild
  lib/
    auth/               # Better Auth: server.ts (config) + client.ts
    editor.ts           # Pure functions: grid math, LOD, flood fill, serialization, counting
    image/              # Node-only: transform.ts, thumbnail.ts; client-only: export.ts
    r2.ts               # Cloudflare R2 thumbnail upload (Node-only)
    utils.ts            # Shared helpers
  db/                   # Drizzle schema (auth + app tables) + Neon connection
```

## Editor

The editor at `/editor` provides:

- **Pen / Eraser / Fill** — paint with the active colour (Bresenham-interpolated drags), erase beads, or flood-fill connected regions
- **Show colour codes** — toggle per-bead colour-code labels on the canvas
- **Import from image** — upload an image and convert it into a bead pattern; advanced options include Photo / Illustration modes, merge similar colours, remove background, and excluding colours from the palette
- **Export PNG** — download a printable chart with coordinates, optional colour-code labels, and a bead-usage list
- **Bead usage panel** — a right sidebar showing grid size, total beads, and per-colour counts, updating live as you draw
- **Zoom** — wheel zoom (cursor-centred, 0.5×–20×), percentage input, fit button
- **Pan** — middle-button drag
- **Palette sidebar** — brand switcher, swatches grouped by series
- **Publish** — sign in with GitHub and save the pattern to the gallery with a title and description; your author name comes from your GitHub account

## API

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/patterns?page=1` | List published patterns (paginated) |
| `POST` | `/api/patterns` | Publish a new pattern (GitHub sign-in required) |
| `GET` | `/api/patterns/[id]` | Get a single pattern |
| `PATCH` | `/api/patterns/[id]` | Update a pattern's title, description, or grid (author only) |
| `POST` | `/api/transform` | Convert an image into a bead grid (multipart `file`, `width`, `brandCode`; optional `mode`, `mergeSimilarity`, `removeBackground`, `excludedCodes`) |
| `GET` | `/api/brands` | List all brands with their colors |
| `GET` | `/api/brands/[id]` | Get a single brand with its colors |

## License

[Apache License 2.0](LICENSE)
