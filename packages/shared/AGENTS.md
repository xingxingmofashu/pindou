# AGENTS.md — `@pindou/shared`

Guidance for agent sessions working in `packages/shared`.

## What this package is

The zero-dependency base of the monorepo: shared constants, the bundled palette catalog, and the palette domain types. It is imported by `@pindou/core`, both apps, and bundled into the desktop build. It must not import from any other workspace package.

## Layout

```
src/constants.ts    Limits + shared numbers (see below)
src/palettes.json   The palette catalog — Palette[] (brands with nested colors, ISO date strings)
src/palettes.ts     Brand / Color / Palette types + PALETTES (loads the JSON, converts ISO dates → Date)
src/index.ts        Root barrel — exports ./constants only
```

Two public subpaths:

- `@pindou/shared/constants`
- `@pindou/shared/palettes`

The root barrel exports `./constants` only; palette types/data come from `@pindou/shared/palettes`. `import type` is erased at compile time, so type-only consumers never load the JSON.

`src/constants.ts` holds, among others:

- `MAX_GRID_DIMENSION` (4096), `MAX_GRID_CELLS` (1M), `MAX_FILE_BYTES` (40 MB), `MAX_BODY_BYTES` (20 MB), `MAX_INPUT_PIXELS` (40M)
- `PATTERN_WRITE_LIMIT` / `PATTERN_WRITE_WINDOW_MS` (the publish/edit per-user budget)
- `CELL`, `MIN_PX`, `DEFAULT_ZOOM`, `MIN_ZOOM`, `MAX_ZOOM`, `ZOOM_FACTOR`, `ZOOM_STEP`
- `PATTERNS_PAGE_SIZE`, `MAJOR_GRID_STEP`, `EXPORT_WATERMARK_TEXT`, `GITHUB_URL`
- `EDITOR_BG` / `EDITOR_BG_DARK` (canvas + thumbnail background)

## Palette catalog

`src/palettes.json` is the **single source of truth** for brand/color data — a committed static catalog of 4 brands (mard/perler/artkal/hama) with their full color sets (uuid ids, codes, hexes, series, sort_order). It was snapshotted from the original Neon DB seed (migrations 0006–0008/0011); the `brands`/`colors` DB tables were **removed in migration 0014** (FK dropped first). The uuid ids are stable, so existing `patterns.fk_brand_id` values remain valid.

- Change palettes by editing the JSON and rebuilding — there is no DB table, seed script, or API write path.
- `code` / `name` are uppercase (e.g. `"A1"`); `series` is nullable — use `c.series ?? "?"`.
- Array order / `sortOrder` is significant: the editor's 1-based indices into `palette.colors` depend on it. See `packages/core/AGENTS.md` for the index ↔ code consequences.
- The JSON stores timestamps as ISO strings; `PALETTES` converts them to `Date`.
- The web API serves this catalog through `PaletteService` (see `apps/web/AGENTS.md`).

## Types

There are no `types.ts` files. `Brand`, `Color`, and `Palette` live next to `PALETTES` in `src/palettes.ts`; constants live in `src/constants.ts`. Co-locate any new shared type with the module that defines its data.

## Commands

```bash
pnpm --filter @pindou/shared typecheck
```

There is no test script in this package — it is data and constants only.

## Constraints

- **Zero runtime dependencies.** Do not import from `@pindou/core`, `@pindou/ui`, or either app.
- Keep it framework-agnostic: no React, Next.js, Node built-ins, or DOM APIs.
- Keep the catalog JSON committed and in `sortOrder` order.
