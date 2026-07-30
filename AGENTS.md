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
EditorPage (src/app/editor/page.tsx — user-controlled, DO NOT MODIFY)
├── ToolBar (pen / eraser)
├── ZoomControls (button zoom ±1.3×, editable percentage input, fit button)
├── ColorPalette (left sidebar, brand switcher + swatches grouped by series + eraser)
└── <canvas> → usePixiCanvas hook
```

**`usePixiCanvas` hook** (`src/hooks/use-pixi-canvas.ts`) is a thin coordinator for the PixiJS lifecycle; the logic lives in pure, React-free library modules:

```
src/lib/editor/data.ts       EMPTY sentinel, paintBlock(), serializeGrid() — sparse-grid writes
src/lib/editor/geometry.ts   walkLine() — Bresenham cell-to-cell interpolation
src/lib/editor/render.ts     CELL / MIN_PX constants, lodParams(), drawGrid(), buildBeadEntries()
src/lib/editor/pixi-app.ts   createPixiApp() — PixiJS Application init (pure, React-free)
src/hooks/use-pixi-canvas.ts PixiJS lifecycle coordinator, wheel + pointer events, zoom/pan state
```

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
pxPerDataCell = zoom × CELL (10 world units per data cell)
lodScale = max(1, ceil(MIN_PX (10) / pxPerDataCell))
visualCellWorldSize = lodScale × CELL
```

- At zoom ≥ 100%: lodScale = 1 → one visual cell = one data cell (individual editing)
- At zoom 25%: lodScale = 4 → one visual cell = 4×4 data cells (merged overview)
- Painting at lodScale > 1 fills the entire visual-cell block
- Grid lines are drawn at `visualCellWorldSize` spacing, filling the entire viewport (infinite extent)

### Rendering

Two rendering paths:
- **`rebuild`**: Full rebuild — redraws grid lines AND aggregates painted cells into visual-cell buckets with `buildBeadEntries()` (dominant colour per bucket via `dominant()`), drawing both Graphics layers. Called on zoom change, draw strokes, and resize.
- **`redrawGrid`**: Grid-only redraw — skips bead aggregation entirely. Called during panning since beads are children of the `world` Container and move with it automatically.

### Drawing tools

Both tools are implemented in the pointer interaction effect:

| Tool | Behaviour |
|---|---|
| **Pen** | Paints the active colour into the visual-cell block via `paintBlock()`. Drag uses Bresenham interpolation (`walkLine`) between world-space coords (stored in `drawRef` as `worldX/worldY`, converted back to visual-cell each move via current LOD — survives zoom changes mid-stroke). |
| **Eraser** | Same as pen but writes `EMPTY` (deletes from the sparse map). |

The fill and eyedropper tools were removed. `onColorPick` remains in the hook options only because the user-controlled EditorPage still passes it — nothing currently fires it.

### Zoom / pan

- **Wheel zoom**: Cursor-centred. Uses the **clamped** zoom ratio (`clamped / oldZoom`) to adjust `world.x/y`, preventing cursor drift at zoom limits (0.5×–20×). State sync via rAF throttle.
- **Pan**: Middle-button drag. Uses `redrawGrid` — beads move with the world container.
- **Fit**: Centres world origin at viewport centre, resets to `initialZoom`.

### Pointer event details

- `getBoundingClientRect` is cached on `pointerdown` and reused throughout the stroke.
- `pointercancel` is handled alongside `pointerup` to clean up pan/draw state.
- `onUp` checks `e.button` to only cancel the relevant interaction (middle = pan, left = draw).
- `toWorld` accepts an optional pre-cached `DOMRect` to avoid redundant layout reads.

### Palette system

```
src/types/palette.ts       BeadColor / BeadPalette types (DO NOT MODIFY — user-controlled)
src/lib/palette/registry.ts  ReadonlyMap<string, BeadPalette>, exports PALETTES + DEFAULT_PALETTE_ID
src/lib/palette/brand/*.ts   Individual brand data (MARD 291, Perler, Hama, Artkal)
```

- `BeadColor.id` is lowercase (e.g. `"a1"`), `code`/`name` are uppercase (`"A1"`)
- `BeadColor.series` is optional (`?`) — use `c.series ?? "?"` as fallback
- `PALETTES.get(DEFAULT_PALETTE_ID)` to get the default palette; no helper functions exported from registry
- The active brand lives in `src/lib/palette/active.ts` (module-level external store) behind the `useActivePalette()` hook — ColorPalette (switcher) and usePixiCanvas (rendering) share it because the user-controlled EditorPage cannot wire it as a prop. Only brands registered in `PALETTES` appear in the switcher.

### shadcn/ui components

`src/components/ui/` — managed by shadcn CLI. **NEVER modify these files.** New components are added via `pnpm dlx shadcn@latest add <name>`.

### TypeScript: `@/` path alias maps to `src/`

## Git workflow

- Linear history on `main`, Conventional commits (`feat:`, `fix:`, `chore:`)
- One commit per feature
- Commit message format: `feat: <imperative description>`

## Key constraints

- No user accounts — anonymous publishing via Supabase (planned, not yet implemented)
- Editor canvas must use PixiJS v8 WebGL renderer
- Comments and UI labels use English
- JSDoc conventions for all documentation comments (`/** ... */` with `@param` / `@returns`)
- Grid lines extend infinitely; beads (painted cells) use a sparse Map with no fixed boundary
