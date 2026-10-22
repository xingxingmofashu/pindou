# AGENTS.md

Guidance for agent sessions (e.g. Claude Code, OpenCode, Codex) working in this repository.

## Project

拼豆 (Pindou) — fuse beads / MARD bead pattern editor and community. A Next.js web app plus an offline Electron desktop app, in one pnpm monorepo. Browse anonymously; publishing requires a GitHub sign-in (Better Auth).

## Monorepo layout

pnpm workspace (`pnpm-workspace.yaml`, `nodeLinker: hoisted`). Strict one-way dependency chain: `@pindou/shared ← @pindou/core ← @pindou/ui ← @pindou/web` (desktop depends on all three packages).

- `apps/web` — `@pindou/web`, the deployable Next.js 16 app (`src/`)
- `apps/desktop` — `@pindou/desktop`, offline Electron editor (local SQLite)
- `packages/shared` — `@pindou/shared`: zero-dependency constants, domain types, `palettes.json`
- `packages/core` — `@pindou/core`: framework-agnostic logic (`editor`, `export`, `transform`, `date`, `utils`), shared React hooks (`hooks/*`), i18n, and Node-only infra (`server/*`)
- `packages/ui` — `@pindou/ui`: Base UI + Tailwind primitives (`components/ui/*`), shared editor components/dialogs, and shared page components (`pages/*`)

Packages publish **from source** (`"main": "./src/index.ts"` + subpath exports) — there is no package build step; Next transpiles them. Import via subpaths (`@pindou/core/editor`, `@pindou/core/hooks/use-editor`, `@pindou/shared/constants`, `@pindou/ui/pages/editor-page`, `@pindou/ui/components/dialogs/publish-dialog`). Keep `@pindou/ui` free of Next.js imports and keep web-only concerns (auth, Next router, theming, worker creation) injected into shared components as props/hooks — the dependency graph must stay acyclic.

## Commands

Run from the repo root; scripts delegate to workspaces:

```bash
pnpm dev          # @pindou/web dev server (Turbopack, http://localhost:3000)
pnpm build        # @pindou/web production build (also runs the web TypeScript typecheck)
pnpm start        # @pindou/web production server
pnpm lint         # @pindou/web ESLint
pnpm test         # @pindou/core vitest suite (pure Node, no browser)
pnpm db:generate  # drizzle-kit generate (apps/web/drizzle)
pnpm db:migrate   # apply pending migrations to Neon
pnpm desktop:dev      # @pindou/desktop electron-forge start
pnpm desktop:package  # @pindou/desktop package
pnpm desktop:make     # @pindou/desktop make (out/make)
```

- Tests: `pnpm test` runs `@pindou/core`'s vitest characterization suite (`packages/core/test/`, pure Node — no DOM). Verification is `pnpm test` + `pnpm lint` + `pnpm build`.
- There is **no web `typecheck` script** — `pnpm build` runs it. Per-package typecheck: `pnpm --filter @pindou/desktop typecheck` and `pnpm --filter @pindou/core typecheck` (also `@pindou/shared`, `@pindou/ui`).
- A husky `pre-commit` hook runs `pnpm lint` on every commit (commits are lint-gated; `--no-verify` to bypass if truly needed).
- DB-backed commands (`db:migrate`, and any code path that touches the pool in `apps/web/src/db/index.ts`) need `DATABASE_URL` in `apps/web/.env` (gitignored, Neon Postgres). `apps/web/drizzle.config.ts` reads it via `process.env.DATABASE_URL!`.
- Env is per-platform and gitignored, all under `apps/web/`: `.env` (local), `.env.preview`, `.env.vercel.production`, `.env.netlify.production` (each carries its own `BETTER_AUTH_URL`/OAuth creds). `.env.example` is the committed template — copy it, don't invent vars.
- `ANALYZE=true pnpm build` (or in `apps/web`) writes bundle reports to `.next/analyze` (`@next/bundle-analyzer`).

## Skills

Repo-pinned skills live in `.claude/skills/` and `.agents/skills/`, tracked by the root `skills-lock.json`: a full **PixiJS v8** set (application, core-concepts, events, scene-text, math, environments), **shadcn**, **better-auth-best-practices**, **create-auth**, and **vercel-react-best-practices** / **vercel-composition-patterns**. Load the relevant skill before PixiJS v8 or shadcn/ui work — they match the exact library versions in use.

## Tech stack

- **Next.js 16** App Router, TypeScript strict, `apps/web/src`
- **Tailwind CSS v4** with the `shadcn/tailwind.css` theme (entry `packages/ui/src/index.css`)
- **shadcn/ui** with **Base UI** primitives (NOT Radix)
- **PixiJS v8** for the editor canvas (WebGL)
- **Zustand** for shared editor/pattern state (in `packages/core/src/hooks/`)
- **SWR** for client-side data fetching (`useSWR` GETs, `useSWRMutation` POSTs; shared `fetcher`/`postJson` in `@pindou/core/utils`)
- **culori** for color-space conversions
- **Upstash Redis** (`@upstash/ratelimit` + `@upstash/redis`) for distributed rate limiting
- **Electron 37 + Electron Forge 7** (Vite plugin) for `apps/desktop`
- pnpm package manager

## Base UI (shadcn) differences from Radix

Base UI is used instead of Radix. Key API differences:
- **No `asChild`**: use the `render` prop, e.g. `<TooltipTrigger render={<Button />} />`
- `TooltipProvider` uses `delay` not `delayDuration`
- ToggleGroup `value` is always `string[]` (array), even in single-select mode
- Event handlers (onClick, etc.) go on the shadcn wrapper component, which merges them onto the rendered element

## Architecture

### App routing (`apps/web/src/app/[lang]/...`)

Routes live under the locale segment `[lang]`, grouped by chrome: `(site)/(content)` (home, pattern gallery + detail, download) and `(site)/(workspace)` (editor, pattern edit); `sign-in/` sits at the `[lang]` level. The convention is **server page fetches data → renders a thin `client.tsx` that wraps a shared `@pindou/ui/pages/*` component**, with a sibling `loading.tsx` (route Suspense skeleton) and `error.tsx` (`"use client"` error boundary) per segment. Only the top-level `apps/web/src/app/[lang]/error.tsx` and `global-error.tsx` are fallback boundaries.

- `patterns` (list) — server page: `getPatternsPage` + `redirect` for out-of-range pages + `generateMetadata`; renders `./client.tsx` (`PatternsContentClient`), which wraps `@pindou/ui/pages/patterns-page`.
- `patterns/[id]` (detail) — server page: `getPattern` + `getBrandPalette` + session + `notFound()` + `generateMetadata`; renders `./client.tsx`.
- `patterns/[id]/edit` (under `(workspace)`) — server page: loads pattern + brand palette + session, `notFound()`s missing data, gates non-owners; renders an editable `./client.tsx`.
- `editor` — client page (pure canvas app, no server data fetch), thin wrapper around `@pindou/ui/pages/editor-page`.

### Editor flow (`/editor`)

`apps/web/src/app/[lang]/(site)/(workspace)/editor/page.tsx` is a **thin client wrapper**: it fetches `/api/brands`, wires the GitHub publish flow (`PublishDialog` + SWR mutation) and the `UnsavedChangesGuard`, creates the image worker, and renders the shared `EditorPage` from `@pindou/ui/pages/editor-page`. Cross-component state lives in the `useEditorStore` Zustand store (`@pindou/core/hooks/use-editor.ts`), so toolbar/panels/dialogs read/write the store instead of drilling props.

```
EditorPage (@pindou/ui) — toolbar, panels, dialogs
├── EditorToolbar (pen/eraser/fill/eyedropper, undo/redo, labels, palette/bead-stats toggles, clear, import/export, publish, zoom)
├── ColorPalette panel (left — seeds the active palette from the brands prop / /api/brands)
├── PixiCanvas (middle — wraps <canvas> → usePixiCanvas hook)
├── BeadStatsPanel (right)
└── dialogs: PublishDialog / ImportDialog / ExportDialog (lazy-loaded via next/dynamic)
```

Shared editor pieces live in `@pindou/ui/components/`: `pixi-canvas.tsx`, `color-palette.tsx`, `bead-stats.tsx`, `zoom-controls.tsx`, and `dialogs/{publish,import,export}-dialog.tsx`. Web-only chrome (header, footer, auth nav, theme toggle, PWA) stays in `apps/web/src/components/`.

- **PublishDialog** (title/desc/author → POST `/api/patterns` via `getCellsData`)
- **ImportDialog** (upload → client-side image→grid conversion in a Web Worker → Apply → `loadGrid(grid)`)
- **ExportDialog** (reads grid via `getCellsData` → client-side PNG chart with colour-code labels + bead-usage list, downloads via `@pindou/core/export`). Export text is drawn on small per-tile canvases and composited back, because Safari silently drops canvas text on canvases wider/taller than ~4096px while fills/strokes still render.

Image→grid conversion runs entirely in the browser: `apps/web/src/workers/transform.worker.ts` (a `new Worker(new URL(...))` module) decodes + pre-scales the image with `createImageBitmap`/`OffscreenCanvas`, then feeds the RGBA buffer to `Transform.quantize` in `@pindou/core/transform` — a pure, React-free module (no sharp, no network round-trip). `ImportDialog` lazy-creates the worker (`useRef<Worker>`), tags each request with a `reqId` to drop stale responses, and `terminate()`s on unmount.

The canvas exposes an imperative API (`PixiCanvasApi`: `setZoom`/`fitToCanvas`/`clearCanvas`/`undo`/`redo`/`getCellsData`/`getBeadStats`/`loadGrid`) via an `apiRef` prop; each page registers it into its store with `useEffect(() => setApi(canvasApiRef.current))` so toolbar/panel components drive the canvas through the store instead of props.

**`usePixiCanvas` hook** (`@pindou/core/hooks/use-pixi-canvas.ts`) is a thin coordinator for the PixiJS lifecycle; the logic lives in pure, React-free library modules:

```
packages/core/src/editor.ts        public entry: grid types + class re-exports (no free functions)
packages/core/src/grid/grid.ts     Grid — sparse mutable 1-based-index map (at/bounds/stats/dominant/paintBlock/floodFill/paintLine/clear/clone/equals/toCodeGrid)
packages/core/src/grid/code-grid.ts CodeGrid — dense code grid (from/size/at/forEachPainted(+InWindow)/counts/beadStatsJson/toCells/toGrid)
packages/core/src/grid/grid-history.ts GridHistory — undo/redo snapshots (push/undo/redo/clear, limit)
packages/core/src/grid/viewport.ts Viewport — boundsSize/center, lod(), gridLines()
packages/core/src/grid/bead-renderer.ts BeadRenderer.entries() — bead-layer draw list
packages/core/src/grid/path.ts     Path.walk() — Bresenham interpolation
packages/core/src/palette/palette-index.ts PaletteIndex — code ↔ 1-based index ↔ hex
packages/core/src/palette/color-series.ts  ColorSeries.group()
packages/core/src/most-frequent.ts MostFrequent.of()
packages/core/src/hooks/use-pixi-app.ts    usePixiApp() — PixiJS Application lifecycle hook (owns app.destroy(true))
packages/core/src/hooks/use-pixi-canvas.ts PixiJS lifecycle coordinator, wheel + pointer events, zoom/pan state. Takes a fully-resolved palette argument (never subscribes to the active-palette store itself).
packages/ui/src/components/pixi-canvas.tsx PixiCanvas resolves the palette: read-only views that pin `palette` render without a store subscription; the editor branch subscribes via `usePalette` (in `EditablePaletteBridge`).
```

The canvas grid lives in a ref (`gridRef`, a `Grid`) and mutates **outside React**. To surface changes, `usePixiCanvas` takes an `onGridChange` callback (fired at stroke end, fill, clear, and load — never per pointermove) and exposes `getCellsData()` (dense code grid + `beadStats` JSON for publish/export) and `getBeadStats()` (sparse `BeadStats`: painted dims + per-code counts, O(painted cells), no dense allocation). The editor stores the stats via `setBeadStats` and `BeadStatsPanel` reads them back from the store. Undo/redo snapshots the grid before each destructive op (`GridHistory`, capped at `UNDO_LIMIT` = 50, no-op strokes dropped via `Grid.equals`); the history is **wiped on brand switch** (`clearHistory`) because 1‑based cell indices change meaning across palettes, so stale snapshots would render wrong colours.

```
PixiJS Application (WebGL)
└── Stage
    └── "world" Container (scale = zoom, position = pan offset)
        ├── Graphics "beads" (coloured bead rectangles, rendered first)
        ├── Graphics "grid" (grid lines on top of beads)
        └── Container "labels" (moved inside world so it pans/zooms with the grid automatically)
```

### Stores

`packages/core/src/hooks/`:

- `use-palette.ts` — active brand palette (shared, seeded from the brands prop / `/api/brands`)
- `use-editor.ts` — `/editor` state (tool, colour, labels, panel visibility, bead stats, zoom, undo/redo, dialog open flags)
- `use-edit.ts` — `/patterns/[id]/edit` state (draft title/desc, colour, panels, zoom, saving; `reset()` seeds it on mount)
- `use-pattern.ts` — `/patterns/[id]` read-only state (canvas api + zoom + panel visibility)
- `use-shortcuts.ts` — global B/E/G/I tool-switching keybindings

### Internationalization (`/en`, `/zh`)

Native Next.js i18n (no next-intl): every route lives under `app/[lang]/` and `apps/web/src/proxy.ts` (Next 16 middleware) prefixes requests with a locale detected from `Accept-Language` (`/` → `/en` or `/zh`; `/api/*` and static assets are excluded). `apps/web/next.config.ts` enables `experimental.rootParams` so server components read the segment via `next/root-params` `lang()`.

```
packages/core/src/i18n/config.ts        I18nConfig.locales (["en","zh"]), .defaultLocale, .isLocale(value), .localizedPath(locale, path), .detectLocale(header)
packages/core/src/i18n/dictionaries/    en.json + zh.json (structurally identical; en is the Messages type source)
packages/core/src/i18n/client.tsx       I18nProvider + useI18n() → { locale, t(path, vars) } for client components
packages/core/src/i18n/types.ts         Messages type
apps/web/src/i18n/server.ts             server-only; getDictionary()/getLocale() via lang()
apps/web/src/app/[lang]/layout.tsx      root layout: html lang, generateStaticParams, localized metadata, I18nProvider
apps/web/src/proxy.ts                   locale detection + redirect; matcher excludes _next|api|favicon.ico|.*\..*
```

- **Server components** call `getDictionary()` (no args — locale resolved from the segment). The root layout `[lang]/layout.tsx` cannot use `lang()` (it owns the segment) and reads `params` instead.
- **Client components** read `useI18n()`; the dictionary is passed down by the root layout via `I18nProvider`.
- **Links/routes**: use `I18nConfig.localizedPath(locale, path)` (e.g. `/editor` → `/en/editor`); SWR/API calls stay locale-agnostic absolute paths (`/api/...`).
- **Dates**: date-fns locale `zhCN` (`date-fns/locale`) for `zh`; localized format strings live in the dictionary (`patternDetail.dateFormat`).
- Better Auth OAuth callback `/api/auth/callback/github` is under `/api`, so the proxy never touches it.
- `/api/auth/...` (Better Auth) lives in `apps/web/src/app/api/auth/` via `toNextJsHandler`; the sign-in UI is `apps/web/src/components/` (`auth-nav.tsx`, `theme-toggle.tsx`) and `@pindou/ui/components/github-button.tsx`.

### Data model

- **Infinite sparse grid**: `Grid` wraps `Map<string, number>` where key = `"col,row"` and value = 1‑based palette colour index. 0 = empty (cell absent from the map). Supports negative coordinates; only painted cells consume memory.
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
- `BeadRenderer.entries` is always called with `lodScale = 1` and `cellSize = CELL`
- Grid lines are drawn at `CELL` spacing (data-cell boundaries), filling the entire viewport (infinite extent)

### Rendering

Single render path, **`rebuild`** — redraws grid lines at data-cell spacing AND draws each painted cell as its own bead via `BeadRenderer.entries()` (always called with `lodScale = 1`, so no merging), covering both Graphics layers. Called on zoom change, draw strokes, resize, and pan.

Pan draws beads + grid lines for a **padded** region (`rebuild({ skipLabels: true, padded: true })`) — a slack of `PAN_BUFFER` (0.5×) around the viewport. While a pan stays inside that slack it skips the redraw entirely (beads and grid lines are children of the `world` Container and move with it), only rebuilding when the pan leaves the slack. Labels are never rebuilt during pan, avoiding per-frame text rasterization.

**Canvas sizing**: PixiJS sizes itself from its parent's `clientWidth/clientHeight` (which include padding), so the canvas is wrapped in a **padding-free** `h-full w-full` div in `pixi-canvas.tsx`. Pixi's own resize only reacts to window resizes — `use-pixi-app.ts` adds a `ResizeObserver` on that wrapper, which is what keeps the canvas in sync when the sidebar panels toggle (ColorPalette / BeadStatsPanel). Keep the wrapper padding-free.

### Drawing tools

All four tools are implemented in the pointer interaction effect:

| Tool | Behaviour |
|---|---|
| **Pen** | Paints the active colour into the visual-cell block via `Grid#paintBlock()`. Drag uses Bresenham interpolation (`Path.walk`) between visual-cell coords (stored in `drawRef` as `vc/vr`, rederived from `toPaintTarget` each move at the current LOD — survives zoom changes mid-stroke). |
| **Eraser** | Same as pen but writes `EMPTY` (deletes from the sparse map). |
| **Fill** | Flood-fills a 4-connected region of the start cell's colour via `Grid#floodFill()`. Empty start regions are bounded by the painted bounds ±1, so filling background can't escape to infinity on the unbounded grid; an entirely empty canvas is a no-op. |
| **Eyedropper** | Samples the **dominant** colour across the visual-cell block under the cursor via `Grid#dominant()` (the same block a pen press would paint) and sets it as the active colour via `onColorPick`, then switches back to the pen tool. Empty cells are ignored (no pick, tool stays). While active, hovering a painted cell fires `onHoverCell({ code, hex })` — `null` on empty/leave, throttled to colour changes — which `PixiCanvas` feeds into a cursor-following shadcn Tooltip (`trackCursorAxis="both"`) as a colour preview. |

`ToolKind` is `"pen" | "eraser" | "fill" | "eyedropper"` and lives in `@pindou/core/editor`.

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

**`packages/shared/src/palettes.json` is the single source of palette data** — a committed static catalog of 4 brands (mard/perler/artkal/hama) with their full color sets (uuid ids, codes, hexes, series, sort_order), bundled into both the web and desktop apps. It was snapshotted from the original Neon DB seed (migrations 0006–0008, 0011); the `brands`/`colors` DB tables were **removed in migration 0014** (FK dropped first, then the tables). Palette changes are made by editing the JSON and rebuilding — no DB involved. The uuid ids are stable, so existing `patterns.fk_brand_id` values remain valid.

```
packages/shared/src/palettes.json     The catalog (Palette[] — brands with nested colors, ISO date strings)
packages/shared/src/palettes.ts       PALETTES export — loads the JSON, converts ISO dates → Date
packages/shared/src/types.ts          Brand/Color/Palette types (data source: the JSON, not a DB table)
packages/shared/src/constants.ts      Limits, canvas bg, page size
apps/web/src/lib/server/palettes.ts   PaletteService.byCode / .byId / .matching / .brand / .all — pure in-memory lookups over PALETTES
apps/web/src/app/api/brands/route.ts  GET — all brands with colors nested (the client catalog)
apps/web/src/app/api/brands/[id]/route.ts GET — one brand by uuid id, colors nested (runtime lookup)
apps/web/src/db/schema.ts             patterns table only (fk_brand_id is a plain uuid, no FK constraint)
packages/core/src/hooks/use-palette.ts Editor store (Zustand) — active palette (pushed in by ColorPalette, no fetch of its own)
```

- `code`/`name` are uppercase (e.g. `"A1"`); `series` is nullable — use `c.series ?? "?"`
- Two representations coexist: the editor's **in-memory sparse map holds 1‑based indices** into `palette.colors` (order-dependent), while the **wire/stored grid is code‑based** (`string[][]`, `""` = empty — migration 0012). Colors are served in `sortOrder` (file order) because the in-memory index and the editor's ordering depend on it. Reordering color entries no longer corrupts *published* patterns (codes are stable), but it shifts in-memory index semantics — `Grid#toCodeGrid()` / `CodeGrid#toCells()` take the palette for exactly this reason, and any brand-palette replace must rebuild the code→index binding wherever sparse state is held.
- `/api/brands` is CDN/browser-cacheable: the catalog only changes on a rebuild (committed JSON), so the route sends `Cache-Control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400`. Palette changes propagate only after the next deploy + cache expiry.
- Wire contract between client and server is the brand **code** (a plain string matching `code`, e.g. `"mard"`); the server maps code↔brand uuid (`patterns.fk_brand_id`) internally. `patterns.fk_brand_id` is a **plain uuid column** — the FK to `brands.id` was dropped in migration 0014, so validity is enforced in the app layer (`PaletteService.byCode` on publish; the uuid is preserved on edit).
- `usePalette()` returns `{ palette, setActivePalette }`; it holds only the active palette (a `Palette` — a brand entry with colors nested) and makes no network requests. ColorPalette fetches `/api/brands` (the catalog) for its switcher, builds the chosen brand's palette, and pushes it into the store. The editor canvas (`EditablePaletteBridge`), the export dialog, and the import dialog read the shared palette because the export dialog must use the same palette instance the canvas draws with — a freshly fetched brand could serve a cached colour order and shift every bead. Consumers that need a *specific* brand (pattern detail/edit pages) fetch it directly via `PaletteService.brand` instead. Read-only views pin a `palette` prop and bypass the store. SSR snapshots are null, so hydration stays consistent.

### Server-side (`/api` + database)

```
apps/web/src/app/api/brands/route.ts        GET — all brands + colors (the client catalog)
apps/web/src/app/api/brands/[id]/route.ts   GET — one brand by uuid id + colors
apps/web/src/app/api/patterns/route.ts      GET (paginated list) + POST (publish, per-user rate limited)
apps/web/src/app/api/patterns/[id]/route.ts GET (single pattern) + PATCH (author updates, per-user rate limited)
apps/web/src/lib/server/palettes.ts         PaletteService.byCode(code)/.byId/.matching/.brand/.all — in-memory lookups over the bundled palettes.json (no DB)
apps/web/src/lib/server/patterns.ts         getPatternsPage/getPattern — `unstable_cache`(30s, tags `patterns`/`pattern`) shared by routes + SSR pages; Dates normalized; brandCode resolved via the palette catalog, not a join
apps/web/src/lib/server/meta.ts             pageMetadata
packages/core/src/server/thumbnail.ts       Thumbnail class: generate(grid, palette) → PNG Buffer + upload(png, patternId) → public URL, run on publish — Node-only (imports sharp)
packages/core/src/server/grid-storage.ts    GridStorage class: upload(id, grid) → R2 key, get(key) → grid, delete(key) — the DB stores only the object key
packages/core/src/server/r2.ts              R2 class: upload/get/delete(key) — generic Cloudflare R2 client (S3 API)
packages/core/src/server/rate-limit.ts      RateLimiter.check(key, limit, windowMs) — Upstash sliding window
packages/core/src/export.ts                  exportGridPng — client-only canvas PNG chart (used by ExportDialog)
apps/web/src/lib/utils.ts                   re-exports `cn` from `@pindou/core` + web-only `escapeLike` (Postgres-specific)
apps/web/src/db/                            Drizzle schema + Neon Postgres Pool (@neondatabase/serverless); Better Auth tables in `auth-schema.ts`; migrations in `apps/web/drizzle/`
apps/web/src/lib/auth/                      Better Auth client (`client.ts`) + server (`server.ts`)
```

- **Tables**: `patterns` only (id uuid PK defaultRandom, title, description, author_name, grid_key, fk_brand_id uuid — **no FK constraint**, fk_user_id → auth.users, bead_stats, thumb_url, timestamps). The `brands`/`colors` tables were removed in migration 0014; brand/color data lives exclusively in `packages/shared/src/palettes.json`. `patterns` rows use uuid `id` (default `gen_random_uuid()`) and `created_at`/`updated_at` (`timestamp with time zone`, default `now()`) — the DB generates them, so routes never set them. `patterns.fk_brand_id` holds a brand uuid from the catalog, resolved to a code in the app layer.
- **Grid contract**: the wire format is a **code grid** — `string[][]`, `grid[row][col]` = `""` (empty) or a colour code (e.g. `"A1"`). `/api/patterns` stores/serves codes; the editor converts to its in-memory index-based sparse map via `CodeGrid#toGrid`, and `ImportDialog` feeds the client-side transform's code grid straight into `loadGrid`.
- **Edit flow**: `/patterns/[id]/edit` (under `[lang]/(site)/(workspace)/patterns/[id]/edit/page.tsx`) is a server page that loads the pattern + brand palette + session via `getPattern`/`PaletteService.brand`/`auth`, `notFound()`s missing data, gates non-owners with a notice, then renders an editable `client.tsx` that `PATCH`es the grid/title/desc through `/api/patterns/[id]` via `Http.send` (method `"PATCH"`). Only the owner (session `fkUserId` match) can edit — the API returns 403 otherwise.
- `thumbnail.ts` imports sharp and must never be imported from a client component — only API routes use it. Routes reach the DB through `apps/web/src/lib/server/` helpers — never the pool directly — and palette data is never bundled into the client.
- **Distributed rate limiting**: `RateLimiter.check(key, limit, windowMs)` (in `@pindou/core/server/rate-limit`) uses an Upstash Redis sliding window shared across Vercel + Netlify instances. Publish (`POST /api/patterns`) and edit (`PATCH /api/patterns/[id]`) are rate-limited **per user** (`user:<id>`, 20 req / 60 s), enforced right after the 401 auth check. `RateLimiter.check` **fails open**: a Redis outage or missing env vars resolves `true` (allows) instead of 500ing the route — deployments must set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (Netlify: Production scope + a manual redeploy, since env changes don't auto-redeploy) for throttling to engage.
- **Hard request limits**: the client import dialog rejects images > 40 MB (`MAX_FILE_BYTES`) and > `MAX_INPUT_PIXELS` (40M) before decode. Publish/edit reject JSON bodies > 20 MB (413). Grids are bounded by the wire schema: rows/cols ≤ `MAX_GRID_DIMENSION` (4096), total cells ≤ `MAX_GRID_CELLS` (1,000,000); the importer clamps its output to that budget. Text caps: title ≤ 200, description ≤ 2000, beadStats ≤ 100,000.
- **Grids (Cloudflare R2)**: the grid JSON is **never stored in Postgres** — it lives in R2 under versioned keys `patterns/{patternId}/{uuid}.json` (`GridStorage`, wrapping `R2`). `patterns.grid_key` holds the active object key (migration 0013 renamed `grid_data` → `grid_key`). Each publish/edit uploads a **new** object so a failed DB write can roll back by deleting only the new key, leaving the previous grid intact; after a successful edit the superseded object is garbage-collected. The pattern-detail GET (inside `unstable_cache`) fetches the grid via `grids.get(gridKey)` and 500s if missing. R2 is a **hard read AND write dependency** — grids and thumbnails share the bucket. Required env (copy from `.env.example`): `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.
- **Thumbnails (Cloudflare R2)**: on publish, `Thumbnail` calls `generate` (grid → 128×128 PNG Buffer, background `EDITOR_BG`), then `upload` to a **versioned** key `thumbnails/{patternId}/{uuid}.png` and returns the public URL saved in `patterns.thumb_url`. An upload failure fails the request (503, nothing written); no base64 fallback. Versioned keys let a failed DB write roll back by deleting only the new object and a successful edit garbage-collects the superseded one.
- Image→grid conversion is **client-side** (no `/api/transform`): the import worker filters the active palette by `excludedCodes` before building its OKLab samples (all colours excluded → error) and produces a code grid. Publish posts `brandCode` to `/api/patterns`. Both publish and edit resolve the palette from the bundled catalog via `getPaletteByCode`/`getPaletteById` and store the brand uuid; the GET paths resolve that uuid back to `brandCode` via the same catalog (no join).
- Migration order matters: `brands`/`colors` existed before `patterns.fk_brand_id` (uuid FK, migration 0002 backfills the old text `brand_id` codes to uuids). Palette data was seeded by the idempotent data migrations 0006–0008/0011, then **removed in migration 0014** (FK dropped first, then both tables) — there is no `db:seed` script; `db:migrate` initializes schema. When changing the schema, run `db:generate` → `db:migrate`.
- **Route caching**: `/api/patterns` GET and `/api/patterns/[id]` GET serve data through `unstable_cache` (30s revalidate, tags `patterns`/`pattern`) in `apps/web/src/lib/server/patterns.ts` and set `Cache-Control`; publish (POST) and edit (PATCH) invalidate via `revalidateTag`. The `[id]` route is `force-dynamic` + `private, no-store` because the response includes the session-derived `canEdit`. The client's persisted SWR cache is invalidated across deployments by `apps/web/next.config.ts` inlining a fresh `NEXT_PUBLIC_BUILD_TIME` epoch into the bundle each `next build`.
- **Deploy**: dual-platform (Vercel + Netlify), both configured under `apps/web/` (`vercel.json`, `netlify.toml`; Root Directory / Base = `apps/web`). Both run `db:migrate` before the build **only on production** (`VERCEL_ENV = production` / Netlify `$CONTEXT = production`); preview builds skip migrations. Production `pnpm build` therefore needs `DATABASE_URL` (also set in the CI workflow). Since both hosts share the same Neon DB, migration is idempotent via drizzle's tracking table.
- Database is PostgreSQL on Neon (not the earlier better‑sqlite3/SQLite setup) — don't reintroduce SQLite.

### Desktop app (`apps/desktop`)

Offline Electron editor sharing the PixiJS canvas + editor logic with the web app via `@pindou/*` packages. Built with **Electron Forge 7 + Vite** (`plugin-vite`), packaged by `@electron-forge/package` / `@electron-forge/make`.

```
apps/desktop/
  forge.config.ts        Forge config — packager, makers, plugins, hooks
  vite.main.config.ts    Main + preload build (Vite)
  vite.renderer.config.ts Renderer build (Vite)
  src/
    main/                Main process: index.ts (window, single-instance lock, SwiftShader), ipc.ts, store.ts (SQLite), save-service.ts, auto-update.ts
    main/db/             SQLite Drizzle schema + migrations
    main/storage/        Local file/blob storage helpers
    preload/             contextBridge API surface (window.api)
    renderer/            React UI (Vite) — editor page + local pattern list
    shared/              IPC channel names + types
  drizzle/               SQLite schema + migrations
  resources/             App icon (icon.icns) + source png
```

Key architecture facts:

- **Process split**: main (Node) + preload (contextBridge, `contextIsolation: true`, `sandbox: false`) + renderer (React via Vite). The renderer never touches Node directly — it calls `window.api.*` (preload) which `ipcRenderer.invoke`s the main process.
- **Local persistence**: patterns are saved to a local SQLite DB (`better-sqlite3` + Drizzle) in `store.ts`, not to Neon Postgres. The desktop app is offline-first.
- **Native module packaging (fragile!)**: under pnpm's hoisted layout, `better-sqlite3` + `sharp` live in the workspace-root `node_modules`, not `apps/desktop/node_modules`. `forge.config.ts` has a `packageAfterCopy` hook (`copyClosure`) that copies them with their transitive + platform-optional dependency closure (sharp → `@img/sharp-darwin-arm64` → `@img/sharp-libvips-darwin-arm64`). `prune: false` is required (symlinked node_modules would break), and `asar.unpack: "**/*.{node,dylib}"` unpacks native binaries + dylibs so dlopen works. Any new native dependency must be added to both the `copyClosure` list and `rebuildConfig.onlyModules`.
- **Build output paths**: `vite.renderer.config.ts` sets `build.outDir` to an absolute path (`resolve(__dirname, ".vite/renderer/main_window")`) — the production renderer is loaded from `.vite/renderer/main_window/index.html` via `win.loadFile`. Don't change it to a relative path or packaged builds break.
- **Drizzle migrations in asar**: production reads migrations from `join(app.getAppPath(), "drizzle")` (inside the asar), NOT `process.resourcesPath`. The `packageAfterCopy` hook copies `drizzle/` into the packaged app.
- **Releases**: tagging `v*` triggers `.github/workflows/release-desktop.yml` — builds macOS (arm64, `macos-latest`) + Windows (x64, `windows-latest`), uploads dmg/zip/exe + squirrel `RELEASES`/`*.nupkg`, creates a non-prerelease GitHub Release. Asset names are version-less: `pindou-desktop-mac-arm64.dmg` / `pindou-desktop-win-x64.exe`. (macos-13 was dropped — GitHub retired the Intel runners.)
- **Auto-update is prompt-only**: the app is **not code-signed** (beta), so Electron's autoUpdater / Squirrel.Mac cannot download updates (it rejects the adhoc signature). `auto-update.ts` instead queries `update.electronjs.org` on launch, shows a localized (zh/en by `app.getLocale()`) dialog, and opens the GitHub Releases page on accept. Users install manually (and must `xattr -cr /Applications/Pindou.app` if macOS reports the app as damaged).
- **Window**: frameless (`frame: false`) with in-app window controls via IPC. `app.commandLine.appendSwitch("enable-unsafe-swiftshader")` so PixiJS WebGL works without GPU acceleration.

### shadcn/ui components

`packages/ui/src/components/ui/` — managed by the shadcn CLI (config `packages/ui/components.json`, style `base-nova`, i.e. **Base UI** variants). **NEVER modify these files manually.** Add new ones with `pnpm dlx shadcn@latest add <name>` run from `packages/ui`. The registry (`ui.shadcn.com`) is intermittently unreachable from this network — retry the add a few times if the CLI errors on the registry check.

### TypeScript

- `@/` alias maps to `apps/web/src` (web app only).
- Cross-package imports use subpaths (`@pindou/core/editor`, `@pindou/shared/types`, `@pindou/ui/pages/patterns-page`). There is no build step for packages.

## Git workflow

- Linear history on `main`, Conventional commits (`feat:`, `fix:`, `chore:`)
- One commit per feature
- Commit message format: `feat: <imperative description>`
- Merge PRs with rebase (`gh pr merge --rebase`), never merge commits

## Key constraints

- Editor canvas must use PixiJS v8 WebGL renderer
- JSDoc conventions for all documentation comments (`/** ... */` with `@param` / `@returns`)
- Grid lines extend infinitely; beads (painted cells) use a sparse Map with no fixed boundary
- Keep the `@pindou/shared ← core ← ui ← web` dependency direction; do not import `next/*` in `@pindou/ui`
