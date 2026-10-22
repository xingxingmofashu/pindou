# AGENTS.md — `@pindou/ui`

Guidance for agent sessions working in `packages/ui`.

## What this package is

Shared React UI for the web and desktop apps: Base UI + Tailwind primitives (`src/components/ui/*`), editor components/dialogs, and page-level components (`src/pages/*`). It sits between `@pindou/core` and the apps and must stay **free of Next.js imports** — web-only concerns (auth, routing, theming, worker creation) are injected into these components as props/hooks.

Dependency direction: `@pindou/shared ← @pindou/core ← @pindou/ui ← @pindou/web` (desktop also consumes ui).

## Layout

```
src/index.css                      Tailwind v4 entry + shadcn theme
src/index.ts                       package barrel
src/utils.ts                       `cn` helper (clsx + tailwind-merge)
src/components/ui/                 shadcn-generated primitives (never edit manually)
src/components/pixi-canvas.tsx     <canvas> wrapper → usePixiCanvas; imperative PixiCanvasApi
src/components/color-palette.tsx   brand/colour switcher; seeds the active-palette store
src/components/bead-stats.tsx      per-colour usage panel
src/components/zoom-controls.tsx   zoom in/out/fit
src/components/github-button.tsx   GitHub sign-in button
src/components/auth/               Email/password sign-in form (host injects auth)
src/components/logo.tsx
src/components/unsaved-changes-guard.tsx
src/components/dialogs/            publish / import / export dialogs
src/pages/                         editor-page, patterns-page, pattern-detail-page,
                                   pattern-edit-page, home-page
```

## shadcn/ui primitives

`src/components/ui/` is managed by the shadcn CLI (config `packages/ui/components.json`, style `base-nova` — **Base UI** variants). **NEVER modify these files manually.** Add new ones from `packages/ui`:

```bash
pnpm dlx shadcn@latest add <name>
```

The registry (`ui.shadcn.com`) is intermittently unreachable from this network — retry the add a few times if the CLI errors on the registry check.

### Base UI differences from Radix

Base UI is used instead of Radix. Key API differences:

- **No `asChild`**: use the `render` prop, e.g. `<TooltipTrigger render={<Button />} />`
- `TooltipProvider` uses `delay` not `delayDuration`
- ToggleGroup `value` is always `string[]` (array), even in single-select mode
- Event handlers (`onClick`, etc.) go on the shadcn wrapper component, which merges them onto the rendered element

## Editor composition

`pages/editor-page.tsx` is the shared editor (web `/editor`, desktop `/editor`). The host injects the brand catalog, the primary action, the image worker factory, and its own publish/save dialog:

```ts
interface EditorPageProps {
  brands: Palette[]                    // web: /api/brands; desktop: PALETTES
  primaryLabel: string                 // "Publish" / "Save"
  onPrimary: () => void
  primaryDisabled?: boolean
  createWorker: () => Worker           // worker URL is bundle-specific
  isDark?: boolean
  children?: ReactNode                 // host dialog(s)
}
```

```
EditorPage — toolbar, panels, dialogs
├── EditorToolbar (pen/eraser/fill/eyedropper, undo/redo, labels,
│                  palette/bead-stats toggles, clear, import/export, zoom)
├── ColorPalette panel (left — seeds the active palette from `brands`)
├── PixiCanvas (middle — wraps <canvas> → usePixiCanvas)
├── BeadStatsPanel (right)
└── dialogs: PublishDialog / ImportDialog / ExportDialog
```

Cross-component state lives in the `useEditorStore` Zustand store (`@pindou/core/hooks/use-editor`), so toolbar/panels/dialogs read/write the store instead of drilling props. The canvas exposes its imperative API via `apiRef`; `EditorPage` registers it with `useEffect(() => setApi(canvasApiRef.current))`.

## Canvas (`pixi-canvas.tsx`)

`PixiCanvas` resolves the palette and renders:

- **Pinned palette** (read-only views): pass `palette`; no subscription to the active-palette store.
- **Editor**: goes through `EditablePaletteBridge`, which subscribes with `usePalette`.

The wrapper around `<canvas>` must stay **padding-free** (`h-full w-full`): PixiJS sizes itself from `parent.clientWidth/clientHeight`, which include padding. `usePixiApp` adds a `ResizeObserver` on that wrapper so the canvas follows sidebar panel toggles — keep the wrapper's layout box equal to the visible canvas.

## Dialogs

- **PublishDialog** — title/desc/author → the host's POST `/api/patterns` via `getCellsData`. Signed-out users can sign in with a GitHub popup or, when the host injects `onEmailSignIn`, an inline email/password form that preserves the editor draft.
- **ImportDialog** — upload → client-side image→grid conversion in a Web Worker → Apply → `loadGrid(grid)`. The host passes `createWorker` because the worker URL is bundle-specific; the dialog lazy-creates the worker, tags requests with a `reqId` to drop stale responses, and terminates it on unmount.
- **ExportDialog** — reads the grid via `getCellsData` → client-side PNG chart via `Export.size/png/pngBlob` (`@pindou/core/export`). Export text is drawn on small per-tile canvases and composited back, because Safari silently drops canvas text on canvases wider/taller than ~4096px while fills/strokes still render.

## Shared pages

`src/pages/*` are presentational and receive their data/actions as props:

- `editor-page.tsx` — the shared canvas editor (above)
- `patterns-page.tsx` — catalog grid + pagination
- `pattern-detail-page.tsx` — read-only pattern view
- `pattern-edit-page.tsx` — editable title/desc/grid
- `home-page.tsx` — landing content

The web app's route files own the server data fetching and render thin `client.tsx` wrappers around these components (see `apps/web/AGENTS.md`). Do not move Next.js concerns into this package.

## Commands

```bash
pnpm --filter @pindou/ui typecheck
```

## Constraints

- **Do not import `next/*`** or any web-only module.
- Keep the dependency direction: ui may import `@pindou/core` and `@pindou/shared`, never an app.
- Never hand-edit `src/components/ui/*` — use the shadcn CLI.
- Co-locate types with the module that defines them — no `types.ts` files.
