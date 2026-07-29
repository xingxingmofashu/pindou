# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

拼豆 (Pindou) — fuse beads / Perler beads pattern editor and community. Anonymous publishing, no user accounts.

## Commands

```bash
pnpm dev          # Start dev server (Turbopack, default http://localhost:3000)
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
- **No `asChild`**: use the `render` prop, e.g. `<TooltipTrigger render={<Button />} />`
- `TooltipProvider` uses `delay` not `delayDuration`
- ToggleGroup `value` is always `string[]` (array), even in single-select mode
- Event handlers (onClick, etc.) go on the shadcn wrapper component, which merges them onto the rendered element

## Architecture

### Editor flow (`/editor`)

```
EditorPage
├── ToolBar (pen/eraser/fill/eyedropper — all four tools fully wired)
├── ZoomControls (button zoom ±1.3× + fit button)
├── ColorPalette (left sidebar, MARD 291-colour swatches grouped by series + eraser)
└── <canvas> → usePixiCanvas hook
```

**`usePixiCanvas` hook** (`src/hooks/use-pixi-canvas.ts`) manages the entire PixiJS lifecycle:

```
PixiJS Application (WebGL)
└── Stage
    └── "world" Container (scale = zoom, position = pan offset)
        ├── Graphics "beads" (coloured bead rectangles, rendered first)
        └── Graphics "grid" (grid lines on top of beads)
```

### Data model

- **Infinite sparse grid**: `Map<string, number>` where key = `"col,row"` and value = 1‑based palette colour index. 0 = empty (cell absent from the map). Supports negative coordinates; only painted cells consume memory.
- **Colour convention**: 0 = empty / eraser, 1..N = 1‑based index into `palette.colors` (converted to 0‑based with `palette.colors[val - 1]` for array access).

### LOD (Level of Detail) system

The visual grid cell size adapts to zoom so each bead is always large enough to interact with:

```
pxPerDataCell = zoom × BASE_CELL_SIZE (10)
lodScale = max(1, ceil(MIN_VISUAL_PX (10) / pxPerDataCell))
visualCellWorldSize = lodScale × BASE_CELL_SIZE
```

- At zoom ≥ 100%: lodScale = 1 → one visual cell = one data cell (individual editing)
- At zoom 25%: lodScale = 4 → one visual cell = 4×4 data cells (merged overview)
- Painting at lodScale > 1 fills the entire visual-cell block
- Grid lines are drawn at `visualCellWorldSize` spacing, filling the entire viewport (infinite extent)

### Rendering

Two rendering paths:
- **`rebuildAndDraw`**: Full rebuild — redraws grid lines AND iterates all painted cells, buckets them by visual cell, picks the dominant colour per cell with `dominantColor()`, draws both Graphics layers. Called on zoom change, draw strokes, resize, and fill operations.
- **`redrawGridOnly`**: Grid-only redraw — skips bead aggregation entirely. Called during panning since beads are children of the `world` Container and move with it automatically.

### Drawing tools

All four tools are implemented in the pointer interaction effect:

| Tool | Behaviour |
|---|---|
| **Pen** | Paints the active colour into the visual-cell block. Drag uses Bresenham interpolation between world-space coords (stored in `drawRef` as `lastWX/lastWY`, converted back to visual-cell each move via current LOD — survives zoom changes mid-stroke). |
| **Eraser** | Same as pen but writes `EMPTY_CELL` (deletes from the sparse map). |
| **Fill** | Iterative BFS flood fill. Cells are collected atomically — if the queue exceeds `MAX_FILL_CELLS` (100K), the operation aborts with zero modifications. When filling empty space, a Chebyshev bounding box of `MAX_EMPTY_FILL_RADIUS` (500) prevents runaway expansion. |
| **Eyedropper** | Scans the visual-cell block's data cells, aggregates colour counts, and fires `onColorPick` with the dominant colour. |

### Zoom / pan

- **Wheel zoom**: Cursor-centred. Uses the **clamped** zoom ratio (`clamped / oldZoom`) to adjust `world.x/y`, preventing cursor drift at zoom limits (0.5×–20×). State sync via rAF throttle.
- **Pan**: Middle-button drag. Uses `redrawGridOnly` — beads move with the world container.
- **Fit**: Centres world origin at viewport centre, resets to `initialZoom`.

### Pointer event details

- `getBoundingClientRect` is cached on `pointerdown` and reused throughout the stroke.
- `pointercancel` is handled alongside `pointerup` to clean up pan/draw state.
- `onUp` checks `e.button` to only cancel the relevant interaction (middle = pan, left = draw).
- `screenToWorld` accepts an optional pre-cached `DOMRect` to avoid redundant layout reads.

### Palette system

```
src/types/palette.ts       BeadColor / BeadPalette types (DO NOT MODIFY — user-controlled)
src/lib/palette/registry.ts  ReadonlyMap<string, BeadPalette>, exports PALETTES + DEFAULT_PALETTE_ID
src/lib/palette/brand/*.ts   Individual brand data (MARD 291, Perler, Hama, Artkal)
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
- Comments and UI labels use English
- JSDoc conventions for all documentation comments (`/** ... */` with `@param` / `@returns`)
- Grid lines extend infinitely; beads (painted cells) use a sparse Map with no fixed boundary
