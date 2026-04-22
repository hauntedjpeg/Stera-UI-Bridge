import { kebab } from "../naming/kebab.js";
import { KNOWN_FAMILIES, guessStack, lookupFont } from "./registry.js";

export type FontStrategy = "next-font" | "fontsource-variable" | "raw";
export type NextFontConvention = "family-named" | "match-init";

export type FontAssignment = {
  role: string;
  family: string;
};

export type FontEmitResult = {
  declarations: string[];
  warnings: string[];
};

export function emitFontDeclarations(
  assignments: FontAssignment[],
  strategy: FontStrategy,
  nextConvention: NextFontConvention = "family-named",
): FontEmitResult {
  const declarations: string[] = [];
  const warnings: string[] = [];

  for (const { role, family } of assignments) {
    const trimmed = family.trim();
    if (!trimmed) continue;

    if (strategy === "next-font") {
      if (nextConvention === "match-init") {
        declarations.push(`  ${role}: var(${role});`);
        continue;
      }
      const known = lookupFont(trimmed);
      if (known) {
        declarations.push(`  ${role}: var(${known.nextVar});`);
      } else {
        const fallback = `--font-${kebab(trimmed)}`;
        declarations.push(`  ${role}: var(${fallback});`);
        warnings.push(
          `Unknown font family "${trimmed}" — emitted var(${fallback}). Add it to KNOWN_FAMILIES or define the variable in layout.tsx.`,
        );
      }
      continue;
    }

    if (strategy === "fontsource-variable") {
      const known = lookupFont(trimmed);
      if (known) {
        declarations.push(`  ${role}: ${known.fontsourceFamily};`);
      } else {
        const stack = guessStack(trimmed);
        declarations.push(`  ${role}: '${trimmed}', ${stack};`);
        warnings.push(
          `Unknown font family "${trimmed}" — no @fontsource-variable mapping. Emitted generic '${trimmed}', ${stack}.`,
        );
      }
      continue;
    }

    const stack = guessStack(trimmed);
    declarations.push(`  ${role}: ${trimmed}, ${stack};`);
  }

  return { declarations, warnings };
}

export function fontsourceImports(
  assignments: FontAssignment[],
  strategy: FontStrategy,
): string[] {
  if (strategy !== "fontsource-variable") return [];
  const pkgs = new Set<string>();
  for (const { family } of assignments) {
    const known = lookupFont(family);
    if (known) pkgs.add(known.fontsourcePackage);
  }
  return [...pkgs].sort().map((p) => `@import "${p}";`);
}

export const FONT_ROLE_DEFAULTS = ["--font-sans", "--font-mono", "--font-heading"] as const;

export function knownFamilyNames(): string[] {
  return Object.keys(KNOWN_FAMILIES);
}
