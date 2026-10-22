# AGENTS.md — `@pindou/web`

Guidance for agent sessions working in `apps/web`.

## What this app is

The deployable **Next.js 16 App Router** app (`src/`). It owns routing, server data fetching, the API routes, Neon Postgres + Drizzle, Better Auth (GitHub sign-in), i18n wiring, and deployment. The editor/UI itself lives in `@pindou/ui`; the canvas/state logic lives in `@pindou/core`.

## Routing (`src/app/[lang]/...`)

Every route lives under the locale segment `[lang]`, grouped by chrome:

- `(site)/(content)` — home, pattern gallery + detail, download
- `(site)/(workspace)` — editor, pattern edit
- `sign-in/` — sits at the `[lang]` level

The convention is **server page fetches data → renders a thin `client.tsx` that wraps a shared `@pindou/ui/pages/*` component**, with a sibling `loading.tsx` (route Suspense skeleton) and `error.tsx` (`"use client"` error boundary) per segment. Only the top-level `apps/web/src/app/[lang]/error.tsx` and `global-error.tsx` are fallback boundaries.

- `patterns` (list) — server page: `getPatternsPage` + `redirect` for out-of-range pages + `generateMetadata`; renders `./client.tsx` (`PatternsContentClient`), which wraps `@pindou/ui/pages/patterns-page`.
- `patterns/[id]` (detail) — server page: `getPattern` + `getBrandPalette` + session + `notFound()` + `generateMetadata`; renders `./client.tsx`.
- `patterns/[id]/edit` (under `(workspace)`) — server page: loads pattern + brand palette + session, `notFound()`s missing data, gates non-owners; renders an editable `./client.tsx`.
- `editor` — client page (pure canvas app, no server data fetch), thin wrapper around `@pindou/ui/pages/editor-page`.

Web-only chrome (header, footer, auth nav, theme toggle, PWA) stays in `apps/web/src/components/`.

## Editor page flow (`/editor`)

`src/app/[lang]/(site)/(workspace)/editor/page.tsx` is a **thin client wrapper**: it fetches `/api/brands`, wires the GitHub publish flow (`PublishDialog` + SWR mutation) and the `UnsavedChangesGuard`, creates the image worker, and renders the shared `EditorPage` from `@pindou/ui/pages/editor-page`. Cross-component state lives in the `useEditorStore` Zustand store (`@pindou/core/hooks/use-editor.ts`), so toolbar/panels/dialogs read/write the store instead of drilling props.

Image→grid conversion runs entirely in the browser: `src/workers/transform.worker.ts` (a `new Worker(new URL(...))` module) decodes + pre-scales the image with `createImageBitmap`/`OffscreenCanvas`, then feeds the RGBA buffer to `Transform.quantize` in `@pindou/core/transform`. `ImportDialog` receives the worker factory from this page.

## Internationalization (`/en`, `/zh`)

Native Next.js i18n (no next-intl):

- `src/proxy.ts` (Next 16 middleware) prefixes requests with a locale detected from `Accept-Language` (`/` → `/en` or `/zh`; `/api/*` and static assets are excluded).
- `next.config.ts` enables `experimental.rootParams` so server components read the segment via `next/root-params` `lang()`.
- `src/i18n/server.ts` is server-only: `getDictionary()` / `getLocale()` via `lang()`.
- `src/app/[lang]/layout.tsx` is the root layout: `html lang`, `generateStaticParams`, localized metadata, `I18nProvider`.
- **Server components** call `getDictionary()` (no args — locale resolved from the segment). The root layout `[lang]/layout.tsx` cannot use `lang()` (it owns the segment) and reads `params` instead.
- **Client components** read `useI18n()`; the dictionary is passed down by the root layout via `I18nProvider`.
- **Links/routes**: use `I18nConfig.localizedPath(locale, path)` (e.g. `/editor` → `/en/editor`); SWR/API calls stay locale-agnostic absolute paths (`/api/...`).
- **Dates**: date-fns locale `zhCN` (`date-fns/locale`) for `zh`; localized format strings live in the dictionary (`patternDetail.dateFormat`).

Sources: `packages/core/src/i18n/config.ts`, `dictionaries/`, `client.tsx` — see `packages/core/AGENTS.md`.

## API and server-side data

```
src/app/api/brands/route.ts        GET — all brands + colors (the client catalog)
src/app/api/brands/[id]/route.ts   GET — one brand by uuid id + colors
src/app/api/patterns/route.ts      GET (paginated list) + POST (publish, per-user rate limited)
src/app/api/patterns/[id]/route.ts GET (single pattern) + PATCH (author updates, per-user rate limited)
src/lib/server/palettes.ts         PaletteService.byCode/.byId/.matching/.brand/.all — in-memory
                                   lookups over the bundled palettes.json (no DB)
src/lib/server/patterns.ts         getPatternsPage/getPattern — unstable_cache (30s, tags
                                   patterns/pattern) shared by routes + SSR pages
src/lib/server/meta.ts             pageMetadata
src/lib/utils.ts                   re-exports cn from @pindou/core + web-only escapeLike
src/db/                            Drizzle schema + Neon Postgres Pool; auth-schema.ts;
                                   migrations in drizzle/
src/lib/auth/                      Better Auth client (client.ts) + server (server.ts)
```

- **Tables**: `patterns` only (id uuid PK defaultRandom, title, description, author_name, grid_key, fk_brand_id uuid — **no FK constraint**, fk_user_id → auth.users, bead_stats, thumb_url, timestamps). The `brands`/`colors` tables were removed in migration 0014; brand/color data lives exclusively in `packages/shared/src/palettes.json`. `patterns` rows use uuid `id` and DB-generated `created_at`/`updated_at`, so routes never set them.
- **Grid contract**: the wire format is a **code grid** — `string[][]`, `grid[row][col]` = `""` (empty) or a colour code (e.g. `"A1"`). `/api/patterns` stores/serves codes; the editor converts to its index-based sparse map via `Grid.fromCodeGrid`, and `ImportDialog` feeds the transform's code grid straight into `loadGrid`.
- **Grids (Cloudflare R2)**: grid JSON is **never stored in Postgres** — `GridStorage` uploads it under versioned keys `patterns/{patternId}/{uuid}.json`; `patterns.grid_key` holds the active key. Each publish/edit writes a **new** object so a failed DB write can roll back by deleting only the new key; a successful edit garbage-collects the superseded object. The pattern-detail GET (inside `unstable_cache`) fetches the grid and 500s if missing. R2 is a **hard read AND write dependency** — grids and thumbnails share the bucket.
- **Thumbnails (Cloudflare R2)**: on publish, `Thumbnail.generate` (128×128 PNG, `EDITOR_BG` background) + `upload` to `thumbnails/{patternId}/{uuid}.png`; the public URL goes in `patterns.thumb_url`. An upload failure fails the request (503), no base64 fallback. Versioned keys make rollback/GC safe.
- **Edit flow**: the edit page loads pattern + brand palette + session via `getPattern` / `PaletteService.brand` / `auth`, `notFound()`s missing data, gates non-owners, then renders an editable `client.tsx` that `PATCH`es the grid/title/desc through `/api/patterns/[id]` via `Http.send` (method `"PATCH"`). Only the owner (session `fkUserId`) can edit; the API returns 403 otherwise.
- **Route caching**: `/api/patterns` GET and `/api/patterns/[id]` GET use `unstable_cache` (30s, tags `patterns`/`pattern`) and set `Cache-Control`; publish/edit invalidate via `revalidateTag`. The `[id]` route is `force-dynamic` + `private, no-store` because the response includes session-derived `canEdit`. The client's persisted SWR cache is invalidated across deployments by `next.config.ts` inlining a fresh `NEXT_PUBLIC_BUILD_TIME` epoch each build.
- `thumbnail.ts` (and anything importing sharp) must never be imported from a client component. Routes reach the DB through `src/lib/server/` helpers — never the pool directly — and palette data is never bundled into the client.
- **Distributed rate limiting**: `RateLimiter.check` (`@pindou/core/server/rate-limit`) uses Upstash Redis and **fails open** on Redis outage/missing env. Publish (`POST /api/patterns`) and edit (`PATCH /api/patterns/[id]`) are limited per user (`user:<id>`, 20 req / 60 s) right after the 401 check. Set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (Netlify: Production scope + manual redeploy).
- **Hard request limits**: import rejects images > 40 MB (`MAX_FILE_BYTES`) and > `MAX_INPUT_PIXELS` (40M) before decode. Publish/edit reject JSON bodies > 20 MB (413). Grids: rows/cols ≤ `MAX_GRID_DIMENSION` (4096), total cells ≤ `MAX_GRID_CELLS` (1M); the importer clamps to that budget. Text caps: title ≤ 200, description ≤ 2000, beadStats ≤ 100,000.
- Image→grid conversion is **client-side** (no `/api/transform`): the import worker filters the active palette by `excludedCodes`, builds OKLab samples, and returns a code grid. Publish posts `brandCode`; both publish and edit resolve the palette from the bundled catalog (`getPaletteByCode` / `getPaletteById`) and store the brand uuid. GET paths resolve that uuid back to `brandCode` via the same catalog (no join).
- Migration order matters: `brands`/`colors` existed before `patterns.fk_brand_id` (0002 backfilled old text codes to uuids); palette data was seeded by 0006–0008/0011 and removed in 0014. There is no `db:seed` script. When changing the schema, run `db:generate` → `db:migrate`.

## Palette system (web side)

**`packages/shared/src/palettes.json` is the single source of palette data** (see `packages/shared/AGENTS.md`). In this app:

- `PaletteService` provides `byCode(code)` / `byId` / `matching` / `brand` / `all` over the bundled `PALETTES` (no DB).
- `/api/brands` serves the full catalog with colors nested; it is CDN/browser-cacheable — the catalog only changes on a rebuild, so the route sends `Cache-Control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400`. Changes propagate after the next deploy + cache expiry.
- The wire contract between client and server is the brand **code** (e.g. `"mard"`); the server maps code ↔ brand uuid internally. `patterns.fk_brand_id` is a **plain uuid** (FK to `brands.id` dropped in 0014), so validity is enforced in the app layer (`PaletteService.byCode` on publish; the uuid is preserved on edit).
- Consumers that need a specific brand (pattern detail/edit pages) fetch it directly via `PaletteService.brand`.
- The shared active-palette store (`usePalette`) lives in `@pindou/core`; `ColorPalette` (ui) fetches `/api/brands` for its switcher and pushes the chosen palette into the store.

## Environment

Env is per-platform and gitignored, all under `apps/web/`:

- `.env` (local), `.env.preview`, `.env.vercel.production`, `.env.netlify.production`
- `.env.example` is the committed template — copy it, don't invent vars.

Required for DB-backed code (`db:migrate`, anything touching `src/db/index.ts`): `DATABASE_URL` (Neon Postgres). `drizzle.config.ts` reads it via `process.env.DATABASE_URL!`. R2 needs `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (+ `NEXT_R2_PUBLIC_URL`); rate limiting needs the Upstash vars; auth needs `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.

## Commands

Run from the repo root (scripts delegate to this workspace):

```bash
pnpm dev          # Turbopack dev server, http://localhost:3000
pnpm build        # production build (also runs the web TypeScript typecheck)
pnpm start        # production server
pnpm lint         # ESLint
pnpm db:generate  # drizzle-kit generate (apps/web/drizzle)
pnpm db:migrate   # apply pending migrations to Neon
```

- There is **no web `typecheck` script** — `pnpm build` runs it. For an explicit typecheck: `pnpm --filter @pindou/web exec tsc --noEmit`.
- `ANALYZE=true pnpm build` (or in `apps/web`) writes bundle reports to `.next/analyze` (`@next/bundle-analyzer`).
- A husky `pre-commit` hook runs `pnpm lint` on every commit.

## Deploy

Dual-platform (Vercel + Netlify), both configured under `apps/web/` (`vercel.json`, `netlify.toml`; Root Directory / Base = `apps/web`). Both run `db:migrate` before the build **only on production** (`VERCEL_ENV = production` / Netlify `$CONTEXT = production`); preview builds skip migrations. Production `pnpm build` therefore needs `DATABASE_URL` (also set in the CI workflow). Both hosts share the same Neon DB; migration is idempotent via drizzle's tracking table. Database is PostgreSQL on Neon — don't reintroduce SQLite.

## TypeScript

- `@/` alias maps to `apps/web/src` (web app only).
- Cross-package imports use subpaths (`@pindou/core/grid`, `@pindou/shared/palettes`, `@pindou/ui/pages/patterns-page`); there is no package build step.
- Co-locate types with the module that defines them — no `types.ts` files.
