# AGENTS.md

Guidance for agent sessions (e.g. Claude Code, OpenCode, Codex) working in this repository.

## Project

拼豆 (Pindou) — fuse beads / MARD bead pattern editor and community. Browse anonymously; publishing requires a GitHub sign-in (Better Auth).

## Commands

```bash
pnpm dev          # Start dev server (Turbopack, default http://localhost:3000)
pnpm build        # Production build (also runs the TypeScript typecheck — there is no separate `typecheck` script)
pnpm lint         # ESLint
pnpm db:generate  # Generate a drizzle migration from schema.ts (drizzle-kit)
pnpm db:migrate   # Apply pending migrations to Neon — schema + palette data
```

- There is **no test suite**. Verification is `pnpm lint` + `pnpm build`.
- A husky `pre-commit` hook runs `pnpm lint` on every commit (commits are lint-gated; `--no-verify` to bypass if truly needed).
- DB-backed commands (`db:migrate`, and any code path that touches the pool in `src/db/index.ts`) need `DATABASE_URL` in `.env` (gitignored, Neon Postgres). `drizzle.config.ts` reads it via `process.env.DATABASE_URL!`.
- Env is per-platform and gitignored: `.env` (local), `.env.preview`, `.env.vercel.production`, `.env.netlify.production` (each carries its own `BETTER_AUTH_URL`/OAuth creds). `.env.example` is the committed template — copy it, don't invent vars.

## Skills

Repo-pinned skills live in `.claude/skills/` and `.agents/skills/` (managed via `skills-lock.json`): a full **PixiJS v8** skill set (application, events, scene-text, math, environments) and a **shadcn** skill. Load these before doing PixiJS v8 or shadcn/ui work — they match the exact library versions in use.

## Tech stack

- **Next.js 16** App Router, TypeScript strict, `src/` directory
- **Tailwind CSS v4** with `shadcn/tailwind.css` theme
- **shadcn/ui** with **Base UI** primitives (NOT Radix)
- **PixiJS v8** for the editor canvas (WebGL)
- **Zustand** for shared editor/pattern state (`use-palette.ts`, `use-editor.ts`, `use-edit.ts`, `use-pattern.ts` in `src/hooks/`)
- **SWR** for client-side data fetching (`useSWR` GETs, `useSWRMutation` POSTs; shared `fetcher` in `lib/utils.ts`)
- **culori** for color-space conversions
- **Upstash Redis** (`@upstash/ratelimit` + `@upstash/redis`) for distributed rate limiting
- pnpm package manager

## Base UI (shadcn) differences from Radix

Base UI is used instead of Radix. Key API differences:
- **No `asChild`**: use the `render` prop, e.g. `<TooltipTrigger render={<Button />} />`
- `TooltipProvider` uses `delay` not `delayDuration`
- ToggleGroup `value` is always `string[]` (array), even in single-select mode
- Event handlers (onClick, etc.) go on the shadcn wrapper component, which merges them onto the rendered element

## Architecture

### Editor flow (`/editor`)

The editor is a **client page** (`src/app/[lang]/(site)/(workspace)/editor/page.tsx`) whose subcomponents are inlined; cross-component state lives in the `useEditorStore` Zustand store (`src/hooks/use-editor.ts`), so the toolbar, panels, and dialogs read/write the store instead of drilling props. A sibling `loading.tsx` (and `error.tsx`) provides the navigation skeleton / error boundary.

```
EditorContent (default export, client)
├── EditorToolbar (inlined: pen/eraser/fill, undo/redo, labels, palette/bead-stats toggles, clear, import/export, publish, zoom)
├── EditorColorPalettePanel (left sidebar — wraps the shared ColorPalette, which seeds the active palette from /api/brands)
├── PixiCanvas (middle — wraps <canvas> → usePixiCanvas hook)
├── EditorBeadStatsPanel (right sidebar — wraps the shared BeadStatsPanel)
└── EditorDialogs (PublishDialog / ImportDialog / ExportDialog, lazy-loaded via next/dynamic)
```

The shared editor pieces now live directly under `src/components/` (no `editor/` subdir): `pixi-canvas.tsx`, `color-palette.tsx`, `bead-stats.tsx`, `zoom-controls.tsx`, and the three dialogs in `src/components/dialogs/` (`publish-dialog.tsx`, `import-dialog.tsx`, `export-dialog.tsx`).

- **PublishDialog** (title/desc/author → POST /api/patterns via `getCellsData`)
- **ImportDialog** (upload → client-side image→grid conversion in a Web Worker → Apply → `loadGrid(grid)`)
- **ExportDialog** (reads grid via `getCellsData` → client-side PNG chart with colour-code labels + bead-usage list, downloads via `src/lib/export.ts`). Export text is drawn on small per-tile canvases and composited back, because Safari silently drops canvas text on canvases wider/taller than ~4096px while fills/strokes still render.

Image→grid conversion runs entirely in the browser: `src/workers/transform.worker.ts` (a `new Worker(new URL(...))` module) decodes + pre-scales the image with `createImageBitmap`/`OffscreenCanvas`, then feeds the RGBA buffer to `Transform.quantize` in `src/lib/transform.ts` — a pure, React-free module (no sharp, no network round-trip). `ImportDialog` lazy-creates the worker (`useRef<Worker>`), tags each request with a `reqId` to drop stale responses, and `terminate()`s on unmount.

### Pages: server data + client content + loading/error boundaries

Routes follow the App Router native convention: **server pages** fetch data through `src/lib/server/*` helpers and render a **client content component** for the interactive parts, with a sibling `loading.tsx` (route Suspense skeleton) and `error.tsx` (`"use client"` error boundary) per segment. Cross-component state still lives in page-scoped Zustand stores (module-level, hydrated client-side). Only the top-level `src/app/[lang]/error.tsx` and `global-error.tsx` remain as fallback boundaries; each leaf segment adds its own `loading.tsx`/`error.tsx`.

- `patterns` (list) — server page: `getPatternsPage` + `redirect` for out-of-range pages + `generateMetadata`; renders `<PatternsContentClient>` (`client.tsx`) with resolved rows.
- `patterns/[id]` (detail) — server page: `getPattern` + `getBrandPalette` + session + `notFound()` + `generateMetadata`; renders `<PatternDetailClient>` (`client.tsx`).
- `patterns/[id]/edit` — server page: `getPattern` + `getBrandPalette` + session + `notFound()` + owner gate; renders `<PatternEditContentClient>` (`client.tsx`).
- `editor` — client page (pure canvas app, no server data fetch), with sibling `loading.tsx`/`error.tsx`.

The stores:

- `use-palette.ts` — active brand palette (shared, seeded from `/api/brands` by ColorPalette)
- `use-editor.ts` — `/editor` state (tool, colour, labels, panel visibility, bead stats, zoom, undo/redo, dialog open flags)
- `use-edit.ts` — `/patterns/[id]/edit` state (draft title/desc, colour, panels, zoom, saving; `reset()` seeds it on mount)
- `use-pattern.ts` — `/patterns/[id]` read-only state (canvas api + zoom + panel visibility)
- `use-shortcuts.ts` — global B/E/G/I tool-switching keybindings

The canvas exposes an imperative API (`PixiCanvasApi`: `setZoom`/`fitToCanvas`/`clearCanvas`/`undo`/`redo`/`getCellsData`/`getBeadStats`/`loadGrid`) via an `apiRef` prop; each page registers it into its store with a `useEffect(() => setApi(canvasApiRef.current))` so toolbar/panel components drive the canvas through the store instead of props.

**`usePixiCanvas` hook** (`src/hooks/use-pixi-canvas.ts`) is a thin coordinator for the PixiJS lifecycle; the logic lives in pure, React-free library modules:

```
src/lib/editor.ts         EMPTY/CELL/MIN_PX/MAX_GRID_DIMENSION/MAX_GRID_CELLS, serializeGrid/deserializeGrid/serializeBeadStats, countGridBeads/countBeadStats, gridSize/buildHexByCode/forEachPaintedCell, paintBlock/walkLine/floodFill, lodParams/computeGridLines/buildBeadEntries, getGridBounds/centerViewport, PixiContext/ViewRect/BeadEntry/GridRect/BeadStats types
src/hooks/use-pixi-app.ts    usePixiApp() — PixiJS Application lifecycle hook (owns app.destroy(true))
src/hooks/use-pixi-canvas.ts PixiJS lifecycle coordinator, wheel + pointer events, zoom/pan state. Takes a fully-resolved palette argument (never subscribes to the active-palette store itself).
src/components/pixi-canvas.tsx PixiCanvas resolves the palette: read-only views that pin `palette` render without a store subscription; the editor branch subscribes via `usePalette` (in `EditablePaletteBridge`).
```

The canvas grid lives in a ref (`cellsRef`) and mutates **outside React**. To surface changes, `usePixiCanvas` takes an `onGridChange` callback (fired at stroke end, fill, clear, and load — never per pointermove) and exposes `getCellsData()` (dense code grid + `beadStats` JSON for publish/export) and `getBeadStats()` (sparse `BeadStats`: painted dims + per-code counts, O(painted cells), no dense allocation). The editor stores the stats via `setBeadStats` and `BeadStatsPanel` reads them back from the store. Undo/redo snapshots the sparse map before each destructive op (`pushHistory`, capped at `UNDO_LIMIT` = 50, no-op strokes dropped via `mapsEqual`); the history is **wiped on brand switch** (`clearHistory`) because 1‑based cell indices change meaning across palettes, so stale snapshots would render wrong colours.

```
PixiJS Application (WebGL)
└── Stage
    └── "world" Container (scale = zoom, position = pan offset)
        ├── Graphics "beads" (coloured bead rectangles, rendered first)
        ├── Graphics "grid" (grid lines on top of beads)
        └── Container "labels" (moved inside world so it pans/zooms with the grid automatically)
```

### Internationalization (`/en`, `/zh`)

Native Next.js i18n (no next-intl): every route lives under `app/[lang]/` and `src/proxy.ts` (Next 16 middleware) prefixes requests with a locale detected from `Accept-Language` (`/` → `/en` or `/zh`; `/api/*` and static assets are excluded). `next.config.ts` enables `experimental.rootParams` so server components read the segment via `next/root-params` `lang()`.

```
src/i18n/config.ts        locales (["en","zh"]), defaultLocale, isLocale, localizedPath(locale, path), detectLocale
src/i18n/dictionaries/    en.json + zh.json (structurally identical; en.json is the Messages type source)
src/i18n/server.ts        server-only; getDictionary()/getLocale() via lang(); root layout must use params instead
src/i18n/client.tsx       I18nProvider + useI18n() → { locale, t(path, vars) } for client components
src/app/[lang]/layout.tsx root layout: html lang, generateStaticParams, localized metadata, I18nProvider
src/proxy.ts              locale detection + redirect; matcher excludes _next|api|favicon.ico|.*\..*
```

- **Server components** call `getDictionary()` (no args — locale resolved from the segment). The root layout `[lang]/layout.tsx` cannot use `lang()` (it owns the segment) and reads `params` instead.
- **Client components** read `useI18n()`; the dictionary is passed down by the root layout via `I18nProvider`.
- **Links/routes**: use `localizedPath(locale, path)` (e.g. `/editor` → `/en/editor`); SWR/API calls stay locale-agnostic absolute paths (`/api/...`).
- **Dates**: date-fns locale `zhCN` (`date-fns/locale`) for `zh`; localized format strings live in the dictionary (`patternDetail.dateFormat`).
- Better Auth OAuth callback `/api/auth/callback/github` is under `/api`, so the proxy never touches it.
- `/api/auth/...` (Better Auth) lives in `src/app/api/auth/` via `toNextJsHandler`; the sign-in UI is `src/components/` (`github-button.tsx`, `auth-nav.tsx` — the header's session-aware sign-in/user-menu area).

### Data model

- **Infinite sparse grid**: `Map<string, number>` where key = `"col,row"` and value = 1‑based palette colour index. 0 = empty (cell absent from the map). Supports negative coordinates; only painted cells consume memory.
- **Colour convention**: 0 = empty / eraser, 1..N = 1‑based index into `palette.colors` (converted to 0‑based with `palette.colors[val - 1]` for array access).

### LOD (Level of Detail) system

LOD controls the **paint-brush block size** only — grid lines and beads always render at data-cell resolution (`CELL` / `lodScale = 1`), so an imported pattern keeps its fixed cell count at any zoom.

```
pxPerDataCell = zoom × CELL (10 world units per data cell)
lodScale = max(1, ceil(MIN_PX (10) / pxPerDataCell))
visualCellWorldSize = lodScale × CELL
```

- At zoom ≥ 100%: lodScale = 1 → one brush press targets one data cell
- At zoom 25%: lodScale = 4 → one brush press fills a 4×4 data-cell block
- `buildBeadEntries` is always called with `lodScale = 1` and `cellSize = CELL`
- Grid lines are drawn at `CELL` spacing (data-cell boundaries), filling the entire viewport (infinite extent)

### Rendering

Single render path, **`rebuild`** — redraws grid lines at data-cell spacing AND draws each painted cell as its own bead via `buildBeadEntries()` (always called with `lodScale = 1`, so no merging), covering both Graphics layers. Called on zoom change, draw strokes, resize, and pan.

Pan draws beads + grid lines for a **padded** region (`rebuild({ skipLabels: true, padded: true })`) — a slack of `PAN_BUFFER` (0.5×) around the viewport. While a pan stays inside that slack it skips the redraw entirely (beads and grid lines are children of the `world` Container and move with it), only rebuilding when the pan leaves the slack. Labels are never rebuilt during pan, avoiding per-frame text rasterization.

**Canvas sizing**: PixiJS sizes itself from its parent's `clientWidth/clientHeight` (which include padding), so the canvas is wrapped in a **padding-free** `h-full w-full` div in `pixi-canvas.tsx`. Pixi's own resize only reacts to window resizes — `use-pixi-app.ts` adds a `ResizeObserver` on that wrapper, which is what keeps the canvas in sync when the sidebar panels toggle (ColorPalette / BeadStatsPanel). Keep the wrapper padding-free.

### Drawing tools

All four tools are implemented in the pointer interaction effect:

| Tool | Behaviour |
|---|---|
| **Pen** | Paints the active colour into the visual-cell block via `paintBlock()`. Drag uses Bresenham interpolation (`walkLine`) between visual-cell coords (stored in `drawRef` as `vc/vr`, rederived from `toPaintTarget` each move at the current LOD — survives zoom changes mid-stroke). |
| **Eraser** | Same as pen but writes `EMPTY` (deletes from the sparse map). |
| **Fill** | Flood-fills a 4-connected region of the start cell's colour via `floodFill()`. Empty start regions are bounded by the painted bounds ±1, so filling background can't escape to infinity on the unbounded grid. |
| **Eyedropper** | Samples the **dominant** colour across the visual-cell block under the cursor via `sampleDominantColor()`/`mostFrequent` (the same block a pen press would paint) and sets it as the active colour via `onColorPick`, then switches back to the pen tool. Empty cells are ignored (no pick, tool stays). While active, hovering a painted cell fires `onHoverCell({ code, hex })` — `null` on empty/leave, throttled to colour changes — which `PixiCanvas` feeds into a cursor-following shadcn Tooltip (`trackCursorAxis="both"`) as a colour preview. |

`ToolKind` is `"pen" | "eraser" | "fill" | "eyedropper"` and lives in `src/lib/editor.ts`.

### Zoom / pan

- **Wheel zoom**: Cursor-centred. Uses the **clamped** zoom ratio (`clamped / oldZoom`) to adjust `world.x/y`, preventing cursor drift at zoom limits (0.5×–20×). State sync via rAF throttle.
- **Pan**: Middle- or right-button drag (right-button drag also pans; `contextmenu` is prevented). Padded rebuild via `rebuild({ skipLabels: true, padded: true })` only when the pan leaves the `PAN_BUFFER` slack, so no painted region is ever clipped.
- **Fit**: Centres world origin at viewport centre, resets to `initialZoom`.

### Pointer event details

- `getBoundingClientRect` is cached on `pointerdown` and reused throughout the stroke.
- `pointercancel`/`pointerleave` fire with `button === -1`, so `onUp` resets pan and draw state unconditionally (no button check).
- `contextmenu` is prevented (right-button drag pans).
- `toWorld` accepts an optional pre-cached `DOMRect` to avoid redundant layout reads.

### Palette system

The database is the single source of palette data. Migration
`drizzle/0006_smiling_the_executioner.sql` seeds the 4 brands and 560 colors
(idempotent `ON CONFLICT DO NOTHING`); `0007_peaceful_silver_sable.sql` adds
`brands.sort_order` (mard=0 first); `0008_first_roxanne_simpson.sql`
**replaces** mard's palette wholesale (DELETE + re-INSERT, now 291 colors) — so
the current mard palette comes from 0008, not 0006. Neither the server nor the
client bundles palette data — it is always fetched from the API at runtime.

```
src/types/index.ts                Row types for the three tables (Brand/Color/Pattern) via $inferSelect, plus Palette = Brand & { colors: Color[] } (a brand row with colors nested — the resolved palette shape)
src/db/schema.ts                   brands + colors + patterns (uuid id defaultRandom, timestamptz created_at/updated_at) + generated drizzle-zod wire schemas
src/app/api/brands/route.ts        GET — all brands with their colors nested (the client catalog)
src/app/api/brands/[id]/route.ts   GET — one brand by uuid id with colors nested
src/hooks/use-palette.ts           Editor store (Zustand) — active palette (pushed in by ColorPalette, no fetch of its own)
```

- The row types in `src/types/index.ts` are `$inferSelect` types derived from the Drizzle schema — the schema is the single definition. Wire schemas `BrandSelectSchema`/`ColorSelectSchema` are generated from those rows by drizzle-zod in `src/db/schema.ts` (uuid ids, timestamps coerced from ISO strings). `/api/brands` (the catalog — every brand with its colors nested, `ORDER BY sort_order`) and `/api/brands/[id]` (a single brand by its uuid row id, e.g. a pattern's `brandId`) are the palette endpoints; a resolved palette is a `Palette` (`Brand & { colors: Color[] }` — a brand row with `colors` nested).

- `code`/`name` are uppercase (e.g. `"A1"`); `series` is nullable — use `c.series ?? "?"`
- Two representations coexist: the editor's **in-memory sparse map holds 1‑based indices** into `palette.colors` (order-dependent), while the **wire/stored grid is code‑based** (`string[][]`, `""` = empty — migration 0012, PR "store pattern grids as colour codes"). Colors are still served `ORDER BY sort_order` because the in-memory index and the editor's ordering depend on it. Reordering color rows no longer corrupts *published* patterns (codes are stable), but it does shift in-memory index semantics — `serializeGrid`/`deserializeGrid` take the palette for exactly this reason, and any brand-palette replace must rebuild the code→index binding in code that holds sparse state.
- `/api/brands` is CDN/browser-cacheable: the catalog only changes via `db:migrate`, so the route sends `Cache-Control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400`. Palette changes propagate only after the cache expires.
- Wire contract between client and server is the brand **code** (a plain string matching `brands.code`, e.g. `"mard"`); the server maps code↔brand uuid (`patterns.fk_brand_id`) internally.
- `usePalette()` (in `use-palette.ts`) reads a module-level Zustand store and returns `{ palette, setActivePalette }`; it holds only the active palette (a `Palette` — a brand row with colors nested) and makes no network requests. ColorPalette fetches `/api/brands` (brands with colors nested) for its switcher, builds the chosen brand's palette, and pushes it into the store. The editor canvas (`EditablePaletteBridge`), the export dialog, and the import dialog read the shared palette because the user-controlled EditorPage cannot wire it as a prop (the export dialog must use the same palette instance the canvas draws with — a freshly fetched brand could serve a cached colour order and shift every bead). Consumers that need a *specific* brand (pattern detail/edit pages) fetch it directly in their server page code via `getBrandPalette` instead of touching the store. Read-only views pin a `palette` prop and bypass the store entirely. SSR snapshots are null, so hydration stays consistent.

### Server-side (`/api` + database)

```
src/app/api/brands/route.ts            GET — all brands + colors (the client catalog)
src/app/api/brands/[id]/route.ts       GET — one brand by uuid id + colors
src/app/api/patterns/route.ts          GET (paginated list) + POST (publish, per-user rate limited)
src/app/api/patterns/[id]/route.ts     GET (single pattern) + PATCH (author updates, per-user rate limited)
src/lib/rate-limit.ts               rateLimit(key, limit, windowMs) — Upstash sliding window shared across serverless instances
src/lib/server/palettes.ts         getPaletteByCode(code)/getPaletteById — brand+colors queries routes use instead of the pool
src/lib/server/patterns.ts         getPatternsPage/getPattern — `unstable_cache`(30s, tags `patterns`/`pattern`) data access shared by routes + SSR pages; Dates normalized (cache round-trips JSON)
src/lib/thumbnail.ts                Thumbnail class: generate(grid, palette) → PNG Buffer + upload(png, patternId) → public URL, run on publish — Node-only (imports sharp)
src/lib/grid-storage.ts                GridStorage class: upload(id, grid) → R2 key, get(key) → grid, delete(key) — the DB stores only the object key, never the grid JSON
src/lib/r2.ts                          R2 class: upload/get/delete(key) — generic Cloudflare R2 client (S3 API, @aws-sdk/client-s3); consumers `new R2()` locally — Node-only
src/lib/export.ts                exportGridPng — client-only canvas PNG chart download (used by ExportDialog; must not run on the server)
src/db/                                Drizzle schema + Neon Postgres Pool (@neondatabase/serverless); Better Auth tables live in `auth-schema.ts`
```

- **Tables**: `brands` (id uuid PK defaultRandom, code unique, name, sort_order) · `colors` (id uuid PK defaultRandom, fk_brand_id → brands.id ON DELETE cascade, code, name, hex, series, sort_order, unique (fk_brand_id, code)) · `patterns` (id uuid PK defaultRandom, fk_brand_id → brands.id, …). All three tables share the same audit shape: uuid `id` (default `gen_random_uuid()`) and `created_at`/`updated_at` (`timestamp with time zone`, default `now()`) — the DB generates them, so routes never set them. `brands.code` is the wire brand code; `name` is the display name. Brands are served `ORDER BY sort_order` (mard=0 first), colors `ORDER BY sort_order` (the array index grid cells index into).
- **Grid contract**: the wire format is a **code grid** — `string[][]`, `grid[row][col]` = `""` (empty) or a colour code (e.g. `"A1"`). `/api/patterns` stores/serves codes; the editor converts to its in-memory index-based sparse map via `deserializeGrid`, and `ImportDialog` feeds the client-side transform's code grid straight into `loadGrid`.
- **Edit flow**: `/patterns/[id]/edit` (under `[lang]/(site)/(workspace)/patterns/[id]/edit/page.tsx`) is a server page that loads the pattern + its brand palette + session via `getPattern`/`getBrandPalette`/`auth`, `notFound()`s missing data, gates non-owners with a notice, then renders an editable `<PatternEditContentClient>` (`client.tsx`) that `PATCH`es the grid/title/desc back through `/api/patterns/[id]` via `postJson` (method `"PATCH"`). Only the owner (session `fkUserId` match) can edit — the API returns 403 otherwise.
- `lib/thumbnail.ts` imports sharp and must never be imported from a client component — only the API routes use it. Routes reach the DB through the `src/lib/server/` helpers (`palettes.ts`, `patterns.ts`) — never the pool directly — and palette data is never bundled into the client.
- **Distributed rate limiting**: `rateLimit(key, limit, windowMs)` (in `lib/rate-limit.ts`) uses an Upstash Redis sliding window shared across Vercel + Netlify instances. Publish (`POST /api/patterns`) and edit (`PATCH /api/patterns/[id]`) are rate-limited **per user** (`user:<id>`, 20 req / 60 s) — keyed by session id, enforced right after the 401 auth check. `rateLimit` **fails open**: a Redis outage or missing env vars resolves `true` (allows) instead of 500ing the route, so the endpoints keep working unthrottled — the deployments must set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (Netlify: Production scope + a manual redeploy, since env changes don't auto-redeploy) for throttling to actually engage.
- **Hard request limits**: the client import dialog rejects images > 40 MB (`MAX_FILE_BYTES`) and > `MAX_INPUT_PIXELS` (40M) before decode. Publish/edit reject JSON bodies > 20 MB (413) via content-length + post-read length check. Grids are bounded by the wire schema: rows/cols ≤ `MAX_GRID_DIMENSION` (4096), total cells ≤ `MAX_GRID_CELLS` (1,000,000); the importer clamps its output to that budget so an import always satisfies publish validation. Text caps: title ≤ 200, description ≤ 2000, beadStats ≤ 100,000.
- **Grids (Cloudflare R2)**: the grid JSON itself is **never stored in Postgres** — it lives in R2 under versioned keys `patterns/{patternId}/{uuid}.json` (`GridStorage` in `lib/grid-storage.ts`, which wraps the `R2` class). The `patterns.grid_key` column holds the active object key (migration 0013 renamed `grid_data` → `grid_key` and cleared existing rows). Each publish/edit uploads a **new** object so a failed DB write can roll back by deleting only the new key, leaving the previous grid intact; after a successful edit the superseded object is garbage-collected. The pattern-detail GET (inside the `unstable_cache`) fetches the grid via `grids.get(gridKey)` and 500s if it's missing. R2 is therefore a **hard read AND write dependency** — grid objects and thumbnails share the bucket. Required env vars (copy from `.env.example`): `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.
- **Thumbnails (Cloudflare R2)**: on publish, the `Thumbnail` instance (in `lib/thumbnail.ts`) calls `generate` to render the grid to a PNG Buffer, then `upload` to store it at a **versioned** key `thumbnails/{patternId}/{uuid}.png` via its own `new R2()` instance (class in `lib/r2.ts`) and returns its public URL, which is saved in `patterns.thumb_url`. R2 is a **hard dependency of publishing/editing** — an upload failure fails the request (503, nothing written to the DB); there is no base64 fallback. Like grids, thumbnail keys are versioned, so a failed DB write rolls back by deleting only the new object (leaving the previous thumbnail intact) and a successful edit garbage-collects the superseded object.
- Image→grid conversion is **client-side** (no `/api/transform`): the import worker filters the active palette by `excludedCodes` before building its OKLab samples (all colours excluded → error) and produces a code grid. Publish posts `brandCode` to `/api/patterns`. Both publish and edit build the palette server-side via `getPaletteByCode`/`getPaletteById` (`lib/server/palettes.ts`, colors `ORDER BY sort_order`) and store the brand uuid in `patterns.fk_brand_id`. GET routes join `brands` to return the code as `brandCode` on the wire.
- Migration order matters: `brands`/`colors` must be migrated before `patterns.fk_brand_id` (uuid FK) can be added, and the old `brand_id` text codes are backfilled to uuids in migration 0002. Palette data is loaded by the idempotent data migration 0006 (brands matched by `code`, colors by the unique `(fk_brand_id, code)` pair) — there is no `db:seed` script; `db:migrate` initializes schema **and** data. When changing the schema, run `db:generate` → `db:migrate`.
- **Route caching**: `/api/patterns` GET and `/api/patterns/[id]` GET serve their data through `unstable_cache` (30s revalidate, tags `patterns`/`pattern`) in `lib/server/patterns.ts` and set `Cache-Control`; publish (POST) and edit (PATCH) invalidate via `revalidateTag`. The `[id]` route is `force-dynamic` + `private, no-store` because the response includes the session-derived `canEdit`. The client's persisted SWR cache is invalidated across deployments by `next.config.ts` inlining a fresh `NEXT_PUBLIC_BUILD_TIME` epoch into the bundle each `next build`.
- **Deploy**: dual-platform (Vercel + Netlify). Both `vercel.json` and `netlify.toml` run `db:migrate` before the build **only on production** (`VERCEL_ENV = production` / Netlify `$CONTEXT = production`); preview builds skip migrations. Production `pnpm build` therefore needs `DATABASE_URL` (also set in the CI workflow). Since both hosts share the same Neon DB, migration is idempotent via drizzle's tracking table.
- Database is PostgreSQL on Neon (not the earlier better‑sqlite3/SQLite setup) — don't reintroduce SQLite.

### shadcn/ui components

`src/components/ui/` — managed by shadcn CLI. **NEVER modify these files.** New components are added via `pnpm dlx shadcn@latest add <name>` (this repo is `base-nova`, i.e. **Base UI** variants). The registry (`ui.shadcn.com`) is intermittently unreachable from this network — retry the add a few times if the CLI errors on the registry check.

### TypeScript: `@/` path alias maps to `src/`

## Git workflow

- Linear history on `main`, Conventional commits (`feat:`, `fix:`, `chore:`)
- One commit per feature
- Commit message format: `feat: <imperative description>`
- Merge PRs with rebase (`gh pr merge --rebase`), never merge commits

## Key constraints

- Editor canvas must use PixiJS v8 WebGL renderer
- JSDoc conventions for all documentation comments (`/** ... */` with `@param` / `@returns`)
- Grid lines extend infinitely; beads (painted cells) use a sparse Map with no fixed boundary
