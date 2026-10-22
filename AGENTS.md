# AGENTS.md

Guidance for agent sessions (e.g. Claude Code, OpenCode, Codex) working in this repository.

## Project

拼豆 (Pindou) — fuse beads / MARD bead pattern editor and community. A Next.js web app plus an offline Electron desktop app, in one pnpm monorepo. Browse anonymously; publishing requires an account (GitHub or email/password via Better Auth).

## Monorepo layout

pnpm workspace (`pnpm-workspace.yaml`, `nodeLinker: hoisted`). Strict one-way dependency chain: `@pindou/shared ← @pindou/core ← @pindou/ui ← @pindou/web` (desktop depends on all three packages).

Each workspace owns its **AGENTS.md** with its architecture, commands, and constraints — read the one for the package you touch, and keep it in sync when you change that package:

- `packages/shared/AGENTS.md` — `@pindou/shared`: zero-dependency constants, palette catalog, palette types
- `packages/core/AGENTS.md` — `@pindou/core`: grid/palette/export/transform, PixiJS hooks, stores, i18n, Node-only infra
- `packages/ui/AGENTS.md` — `@pindou/ui`: Base UI + Tailwind primitives, editor components/dialogs, shared pages
- `apps/web/AGENTS.md` — `@pindou/web`: Next.js 16 App Router, API routes, DB/auth, i18n wiring, deploy
- `apps/desktop/AGENTS.md` — `@pindou/desktop`: offline Electron editor (local SQLite)

Packages publish **from source** (`"main": "./src/index.ts"` + subpath exports) — there is no package build step; Next transpiles them. Import via subpaths (`@pindou/core/grid`, `@pindou/core/palette`, `@pindou/core/hooks/use-pixi-canvas`, `@pindou/core/hooks/use-editor`, `@pindou/shared/constants`, `@pindou/ui/pages/editor-page`, `@pindou/ui/components/dialogs/publish-dialog`). Keep `@pindou/ui` free of Next.js imports and keep web-only concerns (auth, Next router, theming, worker creation) injected into shared components as props/hooks — the dependency graph must stay acyclic.

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
- There is **no web `typecheck` script** — `pnpm build` runs it. Per-package typecheck: `pnpm --filter @pindou/<pkg> typecheck` (`shared`, `core`, `ui`, `desktop`).
- A husky `pre-commit` hook runs `pnpm lint` on every commit (commits are lint-gated; `--no-verify` to bypass if truly needed).
- DB-backed commands need `DATABASE_URL` in `apps/web/.env` (Neon Postgres). Env files, platform variables, and deploy steps are documented in `apps/web/AGENTS.md`.

## Skills

Repo-pinned skills live in `.claude/skills/` and `.agents/skills/`, tracked by the root `skills-lock.json`: a full **PixiJS v8** set (application, core-concepts, events, scene-text, math, environments), **shadcn**, **better-auth-best-practices**, **create-auth**, and **vercel-react-best-practices** / **vercel-composition-patterns**. Load the relevant skill before PixiJS v8 or shadcn/ui work — they match the exact library versions in use.

## Tech stack

- **Next.js 16** App Router, TypeScript strict (web)
- **Tailwind CSS v4** with the `shadcn/tailwind.css` theme (entry `packages/ui/src/index.css`)
- **shadcn/ui** with **Base UI** primitives (NOT Radix)
- **PixiJS v8** for the editor canvas (WebGL)
- **Zustand** for shared editor/pattern state
- **SWR** for client-side data fetching (`Http.get` / `Http.send` in `@pindou/core/utils`)
- **culori** for color-space conversions
- **Upstash Redis** (`@upstash/ratelimit` + `@upstash/redis`) for distributed rate limiting
- **Electron 37 + Electron Forge 7** (Vite plugin) for `apps/desktop`
- pnpm package manager

## Conventions

- **TypeScript**: cross-package imports use subpaths; there is no package build step. `@/` maps to `apps/web/src` (web only; see `apps/web/AGENTS.md`).
- **Type placement**: co-locate types with the module that defines them — do **not** add `types.ts` files.
- **UI / Base UI**: Base UI is used instead of Radix. No `asChild` (use the `render` prop), `TooltipProvider` takes `delay`, ToggleGroup's `value` is always `string[]`, and event handlers go on the shadcn wrapper. Details in `packages/ui/AGENTS.md`.
- **Docs**: package-specific details belong in that package's `AGENTS.md`, not here.

## Git workflow

- Linear history on `main`, Conventional commits (`feat:`, `fix:`, `chore:`)
- One commit per feature
- Commit message format: `feat: <imperative description>`
- Merge PRs with rebase (`gh pr merge --rebase`), never merge commits

## Key constraints

- Keep the `@pindou/shared ← core ← ui ← web` dependency direction; do not import `next/*` in `@pindou/ui`.
- Editor canvas must use the PixiJS v8 WebGL renderer.
- Co-locate types with their defining module — no `types.ts` files.
- JSDoc conventions for all documentation comments (`/** ... */` with `@param` / `@returns`).
