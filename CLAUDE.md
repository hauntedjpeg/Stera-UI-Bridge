# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Stera UI Bridge — a Figma plugin that exports Figma variables as a paste-ready `globals.css` for Stera-UI projects. Runs inside Figma Desktop, not a browser.

## Commands (use pnpm)

- `pnpm dev` — watch both bundles concurrently (UI + sandbox)
- `pnpm build` — production build (`dist/code.js` + inlined `dist/index.html`)
- `pnpm test` — vitest run (covers `src/core/`)
- `pnpm test:watch` — vitest watch
- `pnpm test -- src/core/css/generate.test.ts` — single test file
- `pnpm typecheck` — runs both `tsc --noEmit` (sandbox) and `tsc -p tsconfig.ui.json` (UI). Two configs because the sandbox uses Figma plugin typings while the UI uses DOM + React.

After editing source, you must rebuild before reloading the plugin in Figma — Figma Desktop loads `dist/code.js` and `dist/index.html` directly per `manifest.json`.

## Architecture: sandbox ↔ UI split

Figma plugins run in two isolated contexts that talk only via `postMessage`. Respect the boundary:

- `src/code.ts` — **sandbox**. Has access to `figma.*` APIs (`figma.variables.*`, `figma.clientStorage`, `figma.ui.postMessage`). No DOM. Keep this file thin: read variables, persist prefs, relay messages. Bundled with esbuild → `dist/code.js`.
- `src/ui/` — **iframe UI**. React 19 + Tailwind v4. No `figma.*` access; talks to the sandbox by `parent.postMessage({ pluginMessage }, "*")`. Bundled with Vite + `vite-plugin-singlefile` into one HTML file with all JS/CSS inlined (Figma requires a single HTML).
- `src/shared/messages.ts` — the **only** file imported by both sides. Defines `SandboxToUi` / `UiToSandbox` discriminated unions and `StoredPrefs`. When changing the protocol, update both sides plus this file.
- `src/core/` — pure, framework-free conversion logic (OKLCH color math, kebab naming, font strategies, CSS assembly). Imported by the UI; **must not** import `figma.*` or browser/React APIs. This is where most CSS-output bugs are fixed and where vitest runs.

Data flow: UI mounts → posts `load-variables` → sandbox calls `figma.variables.getLocalVariableCollectionsAsync()` and `figma.getLocalTextStylesAsync()`, serializes to `SerializedCollection[]` + `SerializedTextStyle[]`, replies with `variables-loaded` → UI feeds `doc` + `prefs` into `generateGlobalsCss()` (re-runs on every prefs change via `useMemo`).

## CSS generation pipeline (`src/core/css/generate.ts`)

The exporter is opinionated about Figma collection names — it only includes collections named `Color`, `Theme`, or `Typography` (see `INCLUDED_COLLECTIONS`). Collections whose names start with `Reference` are filtered out. Missing the `Color` collection or its Dark mode is a hard error returned to the UI.

One carve-out: `Reference*` collections stay out of `:root`, but their `Radii` group is scanned by `radiusDecls`. Any radius Tailwind doesn't already ship (see `src/core/css/tailwind-defaults.ts`) is emitted as `--radius-<key>` in px inside a `@theme` block, so `rounded-<key>` resolves. Tailwind-identical radii are skipped.

Output structure: `@import` lines → `@custom-variant dark` → optional `@theme inline { … }` (semantic colors mapped to `--color-*`) → optional `@theme { … }` (custom radii) → `:root { … }` (light-mode primitives + typography + semantic) → `.dark { … }` (dark-mode primitives) → generated `@utility st-*` blocks → `STERA_BASE_UTILITIES`.

Variable names go through `normalizeName` → `toKebabName` → `rewriteTypographyHead`. The Typography collection has special-case rewrites (`size` → `font-size`, `weight` → `font-weight`, etc.) that don't apply to other collections.

The `@utility st-*` typography blocks are generated from the file's local text styles by `src/core/css/text-styles.ts`. Each field prefers the variable the text style binds (resolved by Figma variable **id** through the same name map as the `:root` decls) — weights like `Weight/Medium` and `Weight/Strong` can share a numeric value, so binding by id is the only lossless route. Unbound or out-of-export fields fall back to a literal and raise a warning. `STERA_UTILITIES` in `src/core/css/utilities.ts` is now only a fallback for files with no local text styles (i.e. the styles live in a published library); `STERA_BASE_UTILITIES` (`scrollbar-hide` + `@layer base`) is always appended. After assembly, `findUnresolvedReferences` warns about any `var(--…)` in the utilities that the export does not actually emit.

Font emission lives in `src/core/fonts/strategy.ts` and is driven by `StoredPrefs.strategy` (`next-font` | `fontsource-variable` | `raw`) plus `nextConvention` (`family-named` | `match-init`). Known families are mapped via `src/core/fonts/registry.ts`; unknown families emit a warning but still produce output.

## Conventions

- TypeScript everywhere, strict mode, ESM.
- Imports use `.js` extensions even for `.ts` files (NodeNext/Bundler resolution).
- React 19 with the new JSX transform.
- Tailwind v4 (`@tailwindcss/vite`) — no `tailwind.config.js`; styles configured inline in `src/ui/index.css`.
