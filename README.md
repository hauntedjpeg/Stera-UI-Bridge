# Stera UI Bridge

A Figma plugin that exports Figma variables as a **paste-ready `globals.css`** for [Stera-UI](https://ui.stera.sh) projects. No hand-editing required.

## Why

Most token-export plugins emit raw font family names like `--font-sans: Geist;`. In a Next.js project using `next/font`, fonts are injected as CSS variables (e.g. `--font-geist-sans`), so the raw-family output silently fails to load the font. Stera UI Bridge fixes this by prompting for a font strategy and emitting output that matches how your project consumes fonts.

## Install (development)

```bash
pnpm install
pnpm build
```

Then in Figma Desktop: **Plugins → Development → Import plugin from manifest…** and pick `manifest.json`.

During development, `pnpm dev` watches both the UI and sandbox bundles.

## Font strategies

Pick the one that matches how your project loads fonts.

### 1. Next.js / `next/font`

For apps using `next/font/google` or the `geist` package.

Two sub-conventions:

- **Family-named** (default). Emits:
  ```css
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  ```
  Configure your `layout.tsx` to match:
  ```tsx
  import { Geist, Geist_Mono } from "next/font/google";
  const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
  const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
  // <html className={`${geistSans.variable} ${geistMono.variable}`}>
  ```

- **Match `stera-ui init`**. Emits:
  ```css
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  ```
  Drop-in for projects already set up by `stera-ui init`.

### 2. `@fontsource-variable`

For Vite, Remix, or other React setups. Emits `@import` statements and literal family names:

```css
@import "@fontsource-variable/geist";
@import "@fontsource-variable/geist-mono";

--font-sans: 'Geist Variable', sans-serif;
--font-mono: 'Geist Mono Variable', monospace;
```

### 3. Raw family name

For self-hosted or `@font-face` setups:

```css
--font-sans: Geist, sans-serif;
```

## Expected Figma structure

- **At least one Colors collection** with both a **Light** and a **Dark** mode. Missing Dark mode will block export — add a mode named “Dark” (or map one manually in the plugin’s Options tab).
- **Optional**: spacing, radius, size collections as number variables. Choose `rem` or `px` per collection.
- **Optional**: font-family string variables. Name them with `sans`, `mono`, or `heading` to auto-assign roles.

Variable names use Figma’s slash paths: `bg/surface/hover` becomes `--bg-surface-hover`.

## Known font families

The plugin maps these family names to canonical `next/font` variables and `@fontsource-variable` packages. Anything outside this list still works with a warning — the plugin falls back to sensible defaults.

- Geist
- Geist Mono
- Inter
- JetBrains Mono
- Roboto
- Roboto Mono

## Development

```bash
pnpm dev        # watch UI + sandbox
pnpm build      # produce dist/code.js + dist/index.html
pnpm test       # vitest run on core/
pnpm typecheck  # tsc on sandbox + UI
```

## Architecture

- `src/code.ts` — Figma sandbox. Reads variables via `figma.variables.*`, owns `clientStorage`. Thin.
- `src/ui/` — React + Tailwind UI, bundled to a single HTML via Vite.
- `src/core/` — pure, framework-free conversion (OKLCH, naming, font strategies, CSS assembly). Unit-tested.
