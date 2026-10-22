# AGENTS.md — `@pindou/core`

Guidance for agent sessions working in `packages/core`.

## What this package is

The framework-agnostic core shared by the web and desktop apps: the grid model, palette utilities, export/transform services, React hooks (PixiJS canvas + Zustand stores), i18n, and Node-only infrastructure (`src/server/`). It must stay free of `next/*` and web-only concerns.

Dependency direction: `@pindou/shared ← @pindou/core ← @pindou/ui ← @pindou/web` (desktop consumes core too).

## Public subpaths

```
@pindou/core/grid          grid classes + grid types (barrel)
@pindou/core/palette       PaletteIndex, ColorSeries
@pindou/core/hooks/*       usePixiApp, usePixiCanvas, usePalette, useShortcuts,
                           useEditorStore, useEditStore, usePatternStore
@pindou/core/i18n/config   I18nConfig
@pindou/core/i18n/client   Messages type + I18nProvider + useI18n
@pindou/core/export        Export
@pindou/core/transform     Transform
@pindou/core/utils         BeadUsage, cn, HexColor, Http, Json, Keyboard
@pindou/core/most-frequent MostFrequent
@pindou/core/server/*      Thumbnail, GridStorage, R2, RateLimiter (Node-only)
```

The root `@pindou/core` barrel re-exports everything, including the React hooks. Server/API code must import the specific subpaths so it never pulls React, PixiJS, or browser code.

## Grid model (`src/grid/`)

The editor's data model is an **infinite sparse grid**: `Grid` wraps `Map<"col,row", number>` where the value is a 1-based palette colour index. `EMPTY` (0) means the cell is absent from the map. Negative coordinates are allowed; only painted cells consume memory.

```
grid/index.ts        grid barrel: Grid/CodeGrid/GridHistory/Viewport/BeadRenderer/Path + grid types
grid/grid.ts         Grid — sparse mutable 1-based-index map (static fromCodeGrid; at/bounds/stats/
                     dominant/paintBlock/floodFill/paintLine/clear/clone/equals/toCodeGrid);
                     defines GridBounds + BeadStats
grid/code-grid.ts    CodeGrid — dense code grid (from/size/at/forEachPainted(+InWindow)/counts/
                     beadStatsJson/toCells)
grid/grid-history.ts GridHistory — undo/redo snapshots (push/undo/redo/clear, limit)
grid/viewport.ts     Viewport — boundsSize/center, lod(), gridLines(); defines GridRect + ViewRect
grid/bead-renderer.ts BeadRenderer.entries() — bead-layer draw list; defines BeadEntry
grid/path.ts         Path.walk() — Bresenham interpolation
```

- Dependencies stay **one-way**: `Grid → CodeGrid`, never the reverse. `Grid.fromCodeGrid` is the inverse conversion; the previous cycle was deliberately broken.
- `GridHistory.push()` returns `boolean` (false for a no-op stroke), capped at `UNDO_LIMIT` = 50.
- Colour convention: 0 / `EMPTY` = empty or eraser; 1..N indexes `palette.colors` (access with `palette.colors[val - 1]`).
- Two representations coexist: the in-memory sparse map holds **1-based indices** (order-dependent), while the wire/stored grid is **code-based** (`string[][]`, `""` = empty). `Grid#toCodeGrid()` and `CodeGrid#toCells()` take the palette for that mapping.
- Brand switches rebuild the grid and **wipe the history** (`clearHistory`), because 1-based indices change meaning across palettes and stale snapshots would render wrong colours.
- Types live with their defining class (no `types.ts` files), and `grid/index.ts` re-exports them.

## Canvas hooks (`src/hooks/`)

### `usePixiApp` (`use-pixi-app.ts`)

Owns the PixiJS `Application` (and the `world` scene graph) inside a React effect. `app.init` is awaited inside a `requestAnimationFrame`; cleanup runs **synchronously on unmount** and calls `app.destroy(true)` so the WebGL context is released immediately (browsers cap GL contexts). It also adds a `ResizeObserver` on the canvas's parent because Pixi's own resize only reacts to window resizes — this keeps the canvas in sync when sidebar panels toggle. Exports `PixiContext` (the `app` / `world` / `beadsGfx` / `gridGfx` handle).

### `usePixiCanvas` (`use-pixi-canvas.ts`)

A thin coordinator for the PixiJS lifecycle; the logic lives in the pure, React-free modules above. It takes a **fully-resolved palette** argument and never subscribes to the active-palette store itself. It exports `ToolKind`, `CellsData`, and `PixiCanvasApi`.

The canvas grid lives in a ref (`gridRef`, a `Grid`) and mutates **outside React**. To surface changes, `usePixiCanvas` takes an `onGridChange` callback (fired at stroke end, fill, clear, and load — never per pointermove) and exposes:

- `getCellsData()` — dense code grid + `beadStats` JSON for publish/export
- `getBeadStats()` — sparse `BeadStats` (painted dims + per-code counts, O(painted cells), no dense allocation)

`PixiCanvasApi` is the imperative surface the UI exposes via `apiRef`: `setZoom` / `fitToCanvas` / `clearCanvas` / `undo` / `redo` / `getCellsData` / `getBeadStats` / `loadGrid`.

```
PixiJS Application (WebGL)
└── Stage
    └── "world" Container (scale = zoom, position = pan offset)
        ├── Graphics "beads" (coloured bead rectangles, rendered first)
        ├── Graphics "grid" (grid lines on top of beads)
        └── Container "labels" (inside world, so it pans/zooms with the grid)
```

### LOD (Level of Detail)

LOD controls the **paint-brush block size** only — grid lines and beads always render at data-cell resolution (`CELL` / `lodScale = 1`), so an imported pattern keeps its fixed cell count at any zoom.

```
pxPerDataCell = zoom × CELL (10 world units per data cell)
lodScale = max(1, ceil(MIN_PX (10) / pxPerDataCell))
visualCellWorldSize = lodScale × CELL
```

- At zoom ≥ 100%: `lodScale = 1` → one brush press targets one data cell
- At zoom 25%: `lodScale = 4` → one brush press fills a 4×4 data-cell block
- `BeadRenderer.entries` is always called with `lodScale = 1` and `cellSize = CELL`
- Grid lines are drawn at `CELL` spacing (data-cell boundaries), filling the entire viewport (infinite extent)

### Rendering

Single render path, **`rebuild`** — redraws grid lines at data-cell spacing AND draws each painted cell as its own bead via `BeadRenderer.entries()` (always `lodScale = 1`, so no merging), covering both Graphics layers. Called on zoom change, draw strokes, resize, and pan.

Pan draws beads + grid lines for a **padded** region (`rebuild({ skipLabels: true, padded: true })`) — a slack of `PAN_BUFFER` (0.5×) around the viewport. While a pan stays inside that slack it skips the redraw entirely (the `world` Container moves the beads/grid lines with it) and only rebuilds when the pan leaves the slack. Labels are never rebuilt during pan, avoiding per-frame text rasterization.

PixiJS sizes itself from the parent's `clientWidth/clientHeight`; the UI canvas wrapper must stay **padding-free** (see `packages/ui/AGENTS.md`). `usePixiApp`'s `ResizeObserver` handles panel toggles.

### Drawing tools

All four tools are implemented in the pointer interaction effect:

| Tool | Behaviour |
|---|---|
| **Pen** | Paints the active colour into the visual-cell block via `Grid#paintBlock()`. Drag uses Bresenham interpolation (`Path.walk`) between visual-cell coords (stored in `drawRef` as `vc/vr`, rederived from `toPaintTarget` each move at the current LOD — survives zoom changes mid-stroke). |
| **Eraser** | Same as pen but writes `EMPTY` (deletes from the sparse map). |
| **Fill** | Flood-fills a 4-connected region of the start cell's colour via `Grid#floodFill()`. Empty start regions are bounded by the painted bounds ±1, so filling background can't escape to infinity on the unbounded grid; an entirely empty canvas is a no-op. |
| **Eyedropper** | Samples the **dominant** colour across the visual-cell block under the cursor via `Grid#dominant()` (the same block a pen press would paint) and sets it as the active colour via `onColorPick`, then switches back to the pen tool. Empty cells are ignored (no pick, tool stays). While active, hovering a painted cell fires `onHoverCell({ code, hex })` — `null` on empty/leave, throttled to colour changes — which the UI feeds into a cursor-following Tooltip as a colour preview. |

`ToolKind` is `"pen" | "eraser" | "fill" | "eyedropper"` and lives in `@pindou/core/hooks/use-pixi-canvas`.

### Zoom / pan

- **Wheel zoom**: cursor-centred. Uses the **clamped** zoom ratio (`clamped / oldZoom`) to adjust `world.x/y`, preventing cursor drift at the limits (0.5×–20×). State sync via rAF throttle.
- **Pan**: middle- or right-button drag (right-button drag also pans; `contextmenu` is prevented). Padded rebuild via `rebuild({ skipLabels: true, padded: true })` only when the pan leaves the `PAN_BUFFER` slack, so no painted region is ever clipped.
- **Fit**: centres the world origin at the viewport centre and resets to `initialZoom`.

### Pointer event details

- `getBoundingClientRect` is cached on `pointerdown` and reused throughout the stroke.
- `pointercancel` / `pointerleave` fire with `button === -1`, so `onUp` resets pan and draw state unconditionally (no button check).
- `contextmenu` is prevented (right-button drag pans).
- `toWorld` accepts an optional pre-cached `DOMRect` to avoid redundant layout reads.

## Stores (`src/hooks/`)

- `use-palette.ts` — active brand palette (shared, seeded from the brands prop / `/api/brands`); holds only the active palette and makes no network requests
- `use-editor.ts` — `/editor` state (tool, colour, labels, panel visibility, bead stats, zoom, undo/redo, dialog open flags)
- `use-edit.ts` — `/patterns/[id]/edit` state (draft title/desc, colour, panels, zoom, saving; `reset()` seeds it on mount)
- `use-pattern.ts` — `/patterns/[id]` read-only state (canvas api + zoom + panel visibility)
- `use-shortcuts.ts` — global B/E/G/I tool-switching keybindings

## Palette utilities (`src/palette/`)

```
palette/index.ts         palette barrel: PaletteIndex + ColorSeries
palette/palette-index.ts PaletteIndex — code ↔ 1-based index ↔ hex
palette/color-series.ts  ColorSeries.group()
```

`palette/index.ts` is the public barrel. Colours are served in `sortOrder` (file order) because the in-memory index and the editor's ordering depend on it. Reordering colour entries no longer corrupts *published* patterns (codes are stable), but it shifts in-memory index semantics — `Grid#toCodeGrid()` / `CodeGrid#toCells()` take the palette for exactly this reason, and any brand-palette replace must rebuild the code→index binding wherever sparse state is held.

`usePalette` holds only the active palette and makes no network requests; it drops same-code replacements, so the canvas binding can't go stale without the brand-switch rebuild. The editor canvas, export dialog, and import dialog must all read the **same** palette instance the canvas draws with — a freshly fetched brand could serve a cached colour order and shift every bead. Read-only views pin a `palette` prop and bypass the store; SSR snapshots are `undefined` (no palette) so hydration stays consistent.

The web side (`PaletteService`, `/api/brands`, brand code ↔ uuid) lives in `apps/web`.

## i18n (`src/i18n/`)

```
i18n/config.ts        I18nConfig.locales (["en","zh"]), .defaultLocale, .isLocale(value),
                      .localizedPath(locale, path), .detectLocale(header)
i18n/dictionaries/    en.json + zh.json (structurally identical; en is the Messages type source)
i18n/client.tsx       Messages type + I18nProvider + useI18n() → { locale, t(path, vars) }
i18n/index.ts         dictionaries / enDictionary / zhDictionary
```

`Messages = typeof en` is co-located with the client provider — there is no `types.ts`. The web app's server helpers (`getDictionary` / `getLocale`, `layout`, proxy) live in `apps/web`.

## Export (`src/export.ts`)

`Export` is a stateless static service (no instances): `Export.size`, `Export.png`, `Export.pngBlob`. It renders the printable PNG chart client-side (grid + coordinate bands + major grid + colour-code labels + bead-usage list + watermark). Export text is drawn on small per-tile canvases and composited back, because Safari silently drops canvas text on canvases wider/taller than ~4096px while fills/strokes still render. `size()` is also used for the dialog preview. Consumed by `ExportDialog` in `@pindou/ui`.

## Transform (`src/transform.ts`)

Image → grid conversion is client-side. `Transform.quantize` is a pure, React-free module (OKLab nearest-colour over the active palette), fed by the import worker after it filters `excludedCodes`. There is no sharp, no network round-trip, and no `/api/transform`.

## Utils (`src/utils/`)

`BeadUsage`, `cn`, `HexColor`, `Http`, `Json`, `Keyboard`. `cn` stays a free function because shadcn-generated files depend on it; the others are class-style static services where appropriate. `Http.get` / `Http.send` are the shared JSON-over-HTTP helpers used by SWR and publish/edit.

## Node-only infrastructure (`src/server/`)

| File | Responsibility |
|---|---|
| `thumbnail.ts` | `Thumbnail`: `generate(grid, palette)` → 128×128 PNG Buffer, `upload(png, patternId)` → public URL. Uses sharp. |
| `grid-storage.ts` | `GridStorage`: `upload(id, grid)` → versioned R2 key, `get(key)` → grid, `delete(key)`. `patterns.grid_key` stores only the key. |
| `r2.ts` | `R2`: generic Cloudflare R2 client over the S3 API (`R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`). |
| `rate-limit.ts` | `RateLimiter.check(key, limit, windowMs)` — Upstash sliding window, shared across instances. **Fails open** (Redis outage/missing env → allow). |

- These modules import sharp / S3 / Redis and must **never** be imported from a client component. Only API routes/server code use them.
- Grid and thumbnail writes use fresh versioned keys so a failed DB write can roll back by deleting only the new object; after a successful edit the superseded object is garbage-collected.
- Thumbnail upload failure fails the request (503); there is no base64 fallback.

## Commands and tests

```bash
pnpm --filter @pindou/core typecheck
pnpm --filter @pindou/core test    # vitest run
pnpm test                          # same, from the repo root
```

The characterization suite lives in `test/` and is pure Node (no DOM/browser). Run it with `pnpm test`; verification for core changes is `pnpm test` + `pnpm lint` + `pnpm build` (build from the root).

## Constraints

- Framework-agnostic: **no `next/*`**, no web-only concerns.
- Keep the pure grid / export / transform modules React-free; React lives only in `src/hooks/` and `src/i18n/client.tsx`.
- Editor canvas must use the PixiJS v8 WebGL renderer.
- Grid lines extend infinitely; beads use a sparse Map with no fixed boundary.
- Co-locate types with the module that defines them — no `types.ts` files.
- JSDoc on all documentation comments (`/** ... */` with `@param` / `@returns`).
