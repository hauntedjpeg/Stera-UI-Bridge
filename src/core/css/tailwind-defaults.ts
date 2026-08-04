/**
 * Tailwind v4's built-in border-radius scale, in px at a 16px root.
 * Values the Figma Reference collection duplicates are skipped on export —
 * Tailwind already ships them, so re-emitting only overrides rem with px.
 */
export const TAILWIND_RADIUS_PX: Record<string, number> = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
  "3xl": 24,
  "4xl": 32,
};

/**
 * `rounded-full` resolves to `calc(infinity * 1px)` rather than a numeric
 * custom property, so there is nothing to compare against — any Figma value
 * under this key counts as already covered.
 */
export const TAILWIND_RADIUS_SENTINELS = new Set(["full"]);

export function isTailwindDefaultRadius(key: string, px: number): boolean {
  if (TAILWIND_RADIUS_SENTINELS.has(key)) return true;
  return TAILWIND_RADIUS_PX[key] === px;
}
