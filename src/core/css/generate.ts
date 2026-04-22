import type {
  SerializedCollection,
  SerializedVariable,
  SerializedValue,
  FontStrategy,
  NextFontConvention,
  UnitChoice,
} from "../../shared/messages.js";
import { rgbaToOklchCss } from "../color/oklch.js";
import { toKebabName } from "../naming/kebab.js";
import {
  emitFontDeclarations,
  fontsourceImports,
  type FontAssignment,
} from "../fonts/strategy.js";
import { STERA_THEME_INLINE } from "./theme-map.js";

export type GenerateOptions = {
  collections: SerializedCollection[];
  strategy: FontStrategy;
  nextConvention: NextFontConvention;
  unitByCollectionName: Record<string, UnitChoice>;
  prefix?: string;
  darkModeIdByCollectionId: Record<string, string>;
  fontAssignments: FontAssignment[];
};

export type GenerateResult = {
  css: string;
  warnings: string[];
  errors: string[];
};

type VarLookup = Map<string, SerializedVariable>;

function buildLookup(collections: SerializedCollection[]): VarLookup {
  const lookup: VarLookup = new Map();
  for (const c of collections) for (const v of c.variables) lookup.set(v.id, v);
  return lookup;
}

function detectColorCollection(
  collections: SerializedCollection[],
): SerializedCollection | undefined {
  return (
    collections.find((c) => c.variables.some((v) => v.type === "COLOR")) ??
    undefined
  );
}

function detectDarkModeId(
  collection: SerializedCollection,
  override?: string,
): string | undefined {
  if (override && collection.modes.some((m) => m.id === override)) return override;
  return collection.modes.find((m) => /dark/i.test(m.name))?.id;
}

function detectLightModeId(
  collection: SerializedCollection,
  darkModeId: string | undefined,
): string {
  const light = collection.modes.find((m) => /light|default/i.test(m.name));
  if (light) return light.id;
  const notDark = collection.modes.find((m) => m.id !== darkModeId);
  return (notDark ?? collection.modes[0]).id;
}

function renderValue(
  value: SerializedValue,
  lookup: VarLookup,
  prefix: string | undefined,
  unit: UnitChoice,
): string {
  switch (value.kind) {
    case "color":
      return rgbaToOklchCss(value);
    case "number":
      if (unit === "rem") {
        const rounded = Math.round((value.value / 16) * 10000) / 10000;
        return `${rounded}rem`;
      }
      return `${value.value}px`;
    case "string":
      return value.value;
    case "boolean":
      return String(value.value);
    case "alias": {
      const target = lookup.get(value.targetId);
      if (!target) return "/* unresolved alias */";
      return `var(${toKebabName(target.name, prefix)})`;
    }
  }
}

function chooseUnit(
  collectionName: string,
  unitByCollectionName: Record<string, UnitChoice>,
): UnitChoice {
  return unitByCollectionName[collectionName] ?? "rem";
}

function primitiveDeclarations(
  collections: SerializedCollection[],
  lookup: VarLookup,
  modeIdForCollection: (c: SerializedCollection) => string,
  prefix: string | undefined,
  unitByCollectionName: Record<string, UnitChoice>,
): string[] {
  const lines: string[] = [];
  for (const c of collections) {
    const modeId = modeIdForCollection(c);
    const unit = chooseUnit(c.name, unitByCollectionName);
    for (const v of c.variables) {
      if (v.type === "STRING") continue;
      const value = v.valuesByMode[modeId];
      if (!value) continue;
      const name = toKebabName(v.name, prefix);
      lines.push(`    ${name}: ${renderValue(value, lookup, prefix, unit)};`);
    }
  }
  return lines;
}

export function generateGlobalsCss(options: GenerateOptions): GenerateResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const {
    collections,
    strategy,
    nextConvention,
    unitByCollectionName,
    prefix,
    darkModeIdByCollectionId,
    fontAssignments,
  } = options;

  if (collections.length === 0) {
    errors.push(
      "No variable collections found in this Figma file. Create at least a Colors collection with Light and Dark modes, then try again.",
    );
    return { css: "", warnings, errors };
  }

  const colorCollection = detectColorCollection(collections);
  if (!colorCollection) {
    errors.push(
      "No color collection detected. Stera UI Bridge requires a collection with at least one color variable.",
    );
    return { css: "", warnings, errors };
  }

  const darkModeId = detectDarkModeId(
    colorCollection,
    darkModeIdByCollectionId[colorCollection.id],
  );
  if (!darkModeId) {
    errors.push(
      `Color collection "${colorCollection.name}" has no dark mode. Add a mode named "Dark" (or manually map one in the plugin) before exporting.`,
    );
    return { css: "", warnings, errors };
  }

  const lookup = buildLookup(collections);

  const fontResult = emitFontDeclarations(fontAssignments, strategy, nextConvention);
  warnings.push(...fontResult.warnings);

  const imports = ['@import "tailwindcss";', '@import "tw-animate-css";'];
  imports.push(...fontsourceImports(fontAssignments, strategy));

  const lightLines = primitiveDeclarations(
    collections,
    lookup,
    (c) => (c.id === colorCollection.id ? detectLightModeId(c, darkModeId) : c.modes[0].id),
    prefix,
    unitByCollectionName,
  );

  const darkLines = primitiveDeclarations(
    [colorCollection],
    lookup,
    () => darkModeId,
    prefix,
    unitByCollectionName,
  );

  const rootLines: string[] = [];
  if (fontResult.declarations.length > 0) {
    rootLines.push(...fontResult.declarations.map((d) => `  ${d.trimStart()}`));
    rootLines.push("");
  }
  rootLines.push(...lightLines.map((l) => l.replace(/^ {4}/, "  ")));

  const css = [
    imports.join("\n"),
    "",
    "@custom-variant dark (&:is(.dark *));",
    "",
    STERA_THEME_INLINE,
    "",
    ":root {",
    rootLines.join("\n"),
    "}",
    "",
    ".dark {",
    darkLines.map((l) => l.replace(/^ {4}/, "  ")).join("\n"),
    "}",
    "",
  ].join("\n");

  return { css, warnings, errors };
}
