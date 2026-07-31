# 拼豆 Pindou

Fuse bead / Perler bead pattern editor and community. Create pixel-art patterns, share them anonymously, and discover designs from others — no account needed.

## Features

- **Canvas editor** — WebGL-powered (PixiJS v8) with infinite sparse grid, zoom, pan, pen and eraser tools
- **Level-of-detail rendering** — adaptive cell size so beads stay interactive at any zoom level
- **Multi-brand palettes** — MARD (漫漫), Perler, Hama, Artkal with switchable series
- **Anonymous publishing** — publish patterns without creating an account; manage with edit tokens
- **Pattern gallery** — browse recently published patterns with thumbnail previews
- **Detail view** — interactive read-only canvas on each pattern page

## Tech Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) |
| Canvas | PixiJS v8 (WebGL) |
| Styling | Tailwind CSS v4 + shadcn/ui (Base UI) |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
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
    editor/             # Editor page (user-controlled)
    pattern/[id]/       # Pattern detail page
    api/patterns/       # REST API (GET list, POST publish)
  components/
    editor/             # ToolBar, ZoomControls, ColorPalette, PublishDialog
    pattern/            # PatternCard, PatternGrid
    pixi-canvas.tsx     # Reusable PixiJS canvas component
    ui/                 # shadcn/ui components (never edited manually)
  hooks/
    use-pixi-app.ts     # PixiJS Application lifecycle (WebGL context management)
    use-pixi-canvas.ts  # Zoom/pan/draw pointer events, LOD rebuild
    use-active-palette.ts # Active brand store subscription
  lib/
    editor/index.ts     # Pure functions: grid math, LOD, bounds, serialization
    palette/            # Brand color data (MARD, Perler, Hama, Artkal)
    thumbnail.ts        # Server-side PNG thumbnail generation (sharp)
    utils.ts            # Shared helpers
  db/                   # Drizzle schema + migrations (SQLite)
```

## Editor

The editor at `/editor` provides:

- **Pen** — paint with the active color; drag interpolates via Bresenham's algorithm
- **Eraser** — remove beads (sets cell to empty)
- **Zoom** — wheel zoom (cursor-centered, 0.5×–20×), percentage input, fit button
- **Pan** — middle-button drag
- **Palette sidebar** — brand switcher, swatches grouped by series
- **Publish** — save pattern to the gallery with title, description, and optional author name

## API

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/patterns?page=1` | List published patterns (paginated) |
| `POST` | `/api/patterns` | Publish a new pattern |

## License

MIT
