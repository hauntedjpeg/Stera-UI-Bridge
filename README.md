# Stera UI Bridge

A Figma plugin that exports Figma variables and text styles as a paste-ready `globals.css` for [Stera-UI](https://ui.stera.sh) projects.

## Setup

```bash
pnpm install
pnpm build
```

In Figma Desktop: **Plugins → Development → Import plugin from manifest…** and pick `manifest.json`.

## Figma file requirements

- A **`Color`** collection with **Light** and **Dark** modes. Required; if the dark mode has another name, map it in the plugin's Options tab.
- **`Theme`** and **`Typography`** collections are optional. Other collections are ignored, except a `Radii` group inside a `Reference*` collection — those emit `--radius-*` for any radius Tailwind doesn't already ship.
- Local text styles become `@utility st-*` blocks; fields bound to variables resolve to the exported custom properties.

Slash paths become kebab names: `bg/surface/hover` → `--bg-surface-hover`.

## Font strategies

Pick the one matching how your app loads fonts: **`next/font`** — `--font-sans: var(--font-geist-sans)`, or `var(--font-sans)` to match `stera-ui init`; **`@fontsource-variable`** — adds `@import` lines plus literal families; **raw** — the family name as-is. Geist, Geist Mono, Inter, JetBrains Mono, Roboto, and Roboto Mono are mapped by name; other families export with a warning.

## Development

```bash
pnpm dev        # watch UI + sandbox
pnpm test       # vitest on src/core
pnpm typecheck  # sandbox + UI
```

Sandbox in `src/code.ts`, UI in `src/ui/`, conversion logic in `src/core/` — see [CLAUDE.md](CLAUDE.md).
