# AGENTS.md

Guidance for agent sessions (e.g. Claude Code, OpenCode, Codex) working in this repository.

## Project

拼豆 (Pindou) — fuse beads / Perler beads pattern editor and community. Anonymous publishing, no user accounts.

## Commands

```bash
pnpm dev          # Start dev server (Turbopack, default http://localhost:3000)
pnpm build        # Production build (also runs the TypeScript typecheck — there is no separate `typecheck` script)
pnpm lint         # ESLint
pnpm db:generate  # Generate a drizzle migration from schema.ts (drizzle-kit)
pnpm db:migrate   # Apply pending migrations to Neon — schema + palette data
```

- There is **no test suite**. Verification is `pnpm lint` + `pnpm build`.
- DB-backed commands (`db:migrate`, and any code path that touches the pool in `src/db/index.ts`) need `DATABASE_URL` in `.env` (gitignored, Neon Postgres). `drizzle.config.ts` reads it via `process.env.DATABASE_URL!`.

## Skills

Repo-pinned skills live in `.claude/skills/` and `.agents/skills/` (managed via `skills-lock.json`): a full **PixiJS v8** skill set (application, events, scene-text, math, environments) and a **shadcn** skill. Load these before doing PixiJS v8 or shadcn/ui work — they match the exact library versions in use.

## Tech stack

- **Next.js 16** App Router, TypeScript strict, `src/` directory
- **Tailwind CSS v4** with `shadcn/tailwind.css` theme
- **shadcn/ui** with **Base UI** primitives (NOT Radix)
- **PixiJS v8** for the editor canvas (WebGL)
- **Zustand** for the shared editor palette store (`use-palette.ts`)
- **SWR** for client-side data fetching (`useSWR` GETs, `useSWRMutation` POSTs; shared `fetcher` in `lib/utils.ts`)
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
EditorPage (src/app/[lang]/(site)/editor/page.tsx)
├── ToolBar (pen / eraser, labels toggle, clear-canvas, import/export, publish; embeds ZoomControls: ±1.3× buttons, read-only %, fit)
├── ColorPalette (left sidebar, brand switcher + swatches grouped by series + eraser)
├── <canvas> → usePixiCanvas hook
├── PublishDialog (title/desc/author → POST /api/patterns via getCellsData)
├── ImportDialog (upload → POST /api/transform → Apply → loadGrid(grid))
└── ExportDialog (reads grid via getCellsData → client-side PNG chart, downloads via src/lib/export.ts)
```

**`usePixiCanvas` hook** (`src/hooks/use-pixi-canvas.ts`) is a thin coordinator for the PixiJS lifecycle; the logic lives in pure, React-free library modules:

```
src/lib/editor/index.ts      EMPTY/CELL/MIN_PX/MAX_GRID_DIMENSION, serializeGrid/deserializeGrid/computeBeadStats, paintBlock/walkLine, lodParams/computeGridLines/buildBeadEntries, getGridBounds/centerViewport, PixiContext/ViewRect/BeadEntry/GridRect types
src/hooks/use-pixi-app.ts    usePixiApp() — PixiJS Application lifecycle hook (owns app.destroy(true))
src/hooks/use-pixi-canvas.ts PixiJS lifecycle coordinator, wheel + pointer events, zoom/pan state. Takes a fully-resolved palette argument (never subscribes to the active-palette store itself).
src/components/pixi-canvas.tsx PixiCanvas resolves the palette: read-only views that pin `palette` render without a store subscription; the editor branch subscribes via `usePalette` (in `EditablePaletteBridge`).
```

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

### Drawing tools

Both tools are implemented in the pointer interaction effect:

| Tool | Behaviour |
|---|---|
| **Pen** | Paints the active colour into the visual-cell block via `paintBlock()`. Drag uses Bresenham interpolation (`walkLine`) between visual-cell coords (stored in `drawRef` as `vc/vr`, rederived from `toPaintTarget` each move at the current LOD — survives zoom changes mid-stroke). |
| **Eraser** | Same as pen but writes `EMPTY` (deletes from the sparse map). |

The fill and eyedropper tools were removed. `onColorPick` remains as a dead prop on `PixiCanvas` only because the user-controlled EditorPage still passes it (`onColorPick={handleColorPick}`) — the prop is silently dropped and nothing fires it.

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
- Grid cells are 1‑based indices into `palette.colors`, so colors are served `ORDER BY sort_order` (the array index assigned by the data migration). **Never reorder existing color rows** — it would corrupt every published pattern. Replacing a brand's palette (as 0008 did for mard) shifts every index, so it must be paired with a separate `gridData` remap of that brand's published patterns — the migration itself does not re-key them.
- `/api/brands` is CDN/browser-cacheable: the catalog only changes via `db:migrate`, so the route sends `Cache-Control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400`. Palette changes propagate only after the cache expires.
- Wire contract between client and server is the brand **code** (a plain string matching `brands.code`, e.g. `"mard"`); the server maps code↔brand uuid (`patterns.fk_brand_id`) internally.
- `usePalette()` (in `use-palette.ts`) reads a module-level Zustand store and returns `{ palette, setActivePalette }`; it holds only the active palette (a `Palette` — a brand row with colors nested) and makes no network requests. ColorPalette fetches `/api/brands` via `useSWR` for its switcher and pushes the chosen brand (which already carries nested colors) into the store, seeding the first catalog brand on first load. The editor canvas (`EditablePaletteBridge`) and import dialog read the shared palette because the user-controlled EditorPage cannot wire it as a prop. Consumers that need a *specific* brand (pattern detail page, export dialog) fetch it directly with `useSWR` (a single `/api/brands/[id]` call keyed by the brand uuid — colors are nested) instead of touching the store. Consumers must guard `palette === undefined` while it loads (`EditablePaletteBridge` returns null; ColorPalette shows a placeholder). Read-only views pin a `palette` prop and bypass the store entirely. SSR snapshots are null, so hydration stays consistent.

### Server-side (`/api` + database)

```
src/app/api/brands/route.ts            GET — all brands + colors (the client catalog)
src/app/api/brands/[id]/route.ts       GET — one brand by uuid id + colors
src/app/api/patterns/route.ts          GET (paginated list) + POST (publish)
src/app/api/patterns/[id]/route.ts     GET (single pattern)
src/app/api/transform/route.ts         POST (image → grid), `export const runtime = "nodejs"`
src/lib/transform.ts                   transform(buffer, { width, palette }) — Node-only (imports sharp)
src/lib/thumbnail.ts                   generateThumbnail(grid, palette) → base64 PNG, run on publish — Node-only (imports sharp)
src/lib/export.ts                      exportGridPng — client-only canvas PNG chart download (used by ExportDialog; must not run on the server)
src/db/                                Drizzle schema + Neon Postgres Pool (@neondatabase/serverless)
```

- **Tables**: `brands` (id uuid PK defaultRandom, code unique, name, sort_order) · `colors` (id uuid PK defaultRandom, fk_brand_id → brands.id ON DELETE cascade, code, name, hex, series, sort_order, unique (fk_brand_id, code)) · `patterns` (id uuid PK defaultRandom, fk_brand_id → brands.id, …). All three tables share the same audit shape: uuid `id` (default `gen_random_uuid()`) and `created_at`/`updated_at` (`timestamp with time zone`, default `now()`) — the DB generates them, so routes never set them. `brands.code` is the wire brand code; `name` is the display name. Brands are served `ORDER BY sort_order` (mard=0 first), colors `ORDER BY sort_order` (the array index grid cells index into).
- **Grid contract**: conversion returns `number[][]`, `grid[row][col]` = 0 (empty) or 1‑based `palette.colors` index — the same value domain as the editor's sparse map, so `ImportDialog` feeds the result straight into `loadGrid`.
- `lib/transform.ts` and `lib/thumbnail.ts` import sharp and must never be imported from a client component — only the API routes use them. The API routes query the DB directly; palette data is never bundled into the client.
- The editor posts multipart `file + width + brandCode` (brandCode from `usePalette()`) to `/api/transform`; publish posts `brandCode` to `/api/patterns`. Both routes query `brands` + `colors` (ORDER BY `sort_order`) directly to build the palette server-side and store the brand uuid in `patterns.fk_brand_id`. GET routes join `brands` to return the code as `brandCode` on the wire.
- Migration order matters: `brands`/`colors` must be migrated before `patterns.fk_brand_id` (uuid FK) can be added, and the old `brand_id` text codes are backfilled to uuids in migration 0002. Palette data is loaded by the idempotent data migration 0006 (brands matched by `code`, colors by the unique `(fk_brand_id, code)` pair) — there is no `db:seed` script; `db:migrate` initializes schema **and** data. When changing the schema, run `db:generate` → `db:migrate`.
- Database is PostgreSQL on Neon (not the earlier better‑sqlite3/SQLite setup) — don't reintroduce SQLite.

### shadcn/ui components

`src/components/ui/` — managed by shadcn CLI. **NEVER modify these files.** New components are added via `pnpm dlx shadcn@latest add <name>`.

### TypeScript: `@/` path alias maps to `src/`

## Git workflow

- Linear history on `main`, Conventional commits (`feat:`, `fix:`, `chore:`)
- One commit per feature
- Commit message format: `feat: <imperative description>`

## Key constraints

- Editor canvas must use PixiJS v8 WebGL renderer
- JSDoc conventions for all documentation comments (`/** ... */` with `@param` / `@returns`)
- Grid lines extend infinitely; beads (painted cells) use a sparse Map with no fixed boundary
