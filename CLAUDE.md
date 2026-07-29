# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

拼豆 (Pindou) — fuse beads / Perler beads pattern editor and community. Anonymous publishing, no user accounts.

## Commands

```bash
pnpm dev          # Start dev server (Turbopack)
pnpm build        # Production build (TypeScript + static pages)
pnpm lint         # ESLint
```

## Tech stack

- **Next.js 16** App Router, TypeScript strict, `src/` directory
- **Tailwind CSS v4** with `shadcn/tailwind.css` theme
- **shadcn/ui** with **Base UI** primitives (NOT Radix)
- **PixiJS v8** for the editor canvas (WebGL)
- **culori** for color-space conversions
- pnpm package manager

## Base UI (shadcn) differences from Radix

Base UI is used instead of Radix. Key API differences:
- **No `asChild`**: use the `render` prop to swap the rendered element, e.g. `<TooltipTrigger render={<Button />} />`
- `TooltipProvider` uses `delay` not `delayDuration`
- ToggleGroup `value` is always `string[]` (array), even in single-select mode
- Event handlers (onClick, etc.) go on the shadcn wrapper component, which merges them onto the rendered element

## Architecture

### Editor flow (`/editor`)

```
EditorPage
├── ToolBar (pen/eraser/fill/eyedropper — UI only, no logic wired yet)
├── ZoomControls (button zoom ±1.3x + fit button)
└── <canvas> → usePixiCanvas hook
```

**`usePixiCanvas` hook** (`src/hooks/use-pixi-canvas.ts`) manages the entire PixiJS lifecycle:

```
PixiJS Application (WebGL)
└── Stage
    └── "world" Container (scale = zoom, position = pan offset)
        └── Graphics (grid lines)
```

- Grid: `cellSize` world-units per bead (default 10), 1 line per cell boundary, drawn with `Graphics.rect()` + `Graphics.fill()`
- Zoom: min 0.5×, max 20×, default 3× (300%). Wheel zoom is cursor-centered. State sync uses rAF throttle with a ref for the actual value.
- Pan: middle mouse button drag
- Fit: centers world origin at viewport center, resets to `initialZoom`
- Auto-redraws grid on renderer resize

### Palette system

```
src/types/palette.ts       BeadColor / BeadPalette types (DO NOT MODIFY — user-controlled)
src/lib/palette/registry.ts  ReadonlyMap<string, BeadPalette>, exports PALETTES + DEFAULT_PALETTE_ID
src/lib/palette/brand/*.ts   Individual brand data (MARD 291 colors, Perler, Hama, Artkal)
```

- `BeadColor.id` is lowercase (e.g. `"a1"`), `code`/`name` are uppercase (`"A1"`)
- `BeadColor.series` is optional (`?`) — use `c.series ?? "?"` as fallback
- `PALETTES.get(DEFAULT_PALETTE_ID)` to get the active palette; no helper functions exported from registry

### shadcn/ui components

`src/components/ui/` — managed by shadcn CLI. **NEVER modify these files.** New components are added via `pnpm dlx shadcn@latest add <name>`.

### TypeScript: `@/` path alias maps to `src/`

## Git workflow

- Linear history on `main`, English conventional commits (`feat:`, `fix:`, `chore:`)
- One commit per feature
- Commit message format: `feat: <imperative description>`
- Co-Authored-By: Claude <noreply@anthropic.com>

## Key constraints

- No user accounts — anonymous publishing via Supabase (planned, not yet implemented)
- Editor canvas must use PixiJS v8 WebGL renderer
- Grid represents actual bead cells: 1 world unit = 1 cell dimension, grid lines = cell boundaries
