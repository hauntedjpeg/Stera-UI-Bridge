import type {
  SerializedCollection,
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
import { STERA_UTILITIES } from "./utilities.js";

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

const COLOR_PRIMITIVE_COLLECTION = "Base • Color";
const SEMANTIC_COLOR_COLLECTION = "Theme • Color";
const TYPOGRAPHY_COLLECTION = "Base • Typography";
const INCLUDED_COLLECTIONS = new Set([
  COLOR_PRIMITIVE_COLLECTION,
  SEMANTIC_COLOR_COLLECTION,
  TYPOGRAPHY_COLLECTION,
]);
const STRIP_FIRST_SEGMENT = new Set([TYPOGRAPHY_COLLECTION]);
const TYPO_CATEGORY_SEGMENTS = new Set([
  "size",
  "weight",
  "line-height",
  "letter-spacing",
  "font",
]);
type NumberUnit = "rem" | "px" | "unitless";
type NameMap = Map<string, string>;
type Decl = { name: string; head: string; value: string };

function rewriteTypographyHead(head: string, collectionName: string): string {
  if (head === "weight") return "font-weight";
  if (head.startsWith("weight-")) return `font-${head}`;
  if (collectionName !== TYPOGRAPHY_COLLECTION) return head;
  if (head === "font" || head.startsWith("font-")) return head;
  if (head === "letter-spacing" || head.startsWith("letter-spacing-")) return head;
  if (head === "line-height" || head.startsWith("line-height-")) return head;
  if (head === "size") return "font-size";
  if (head.startsWith("size-")) return `font-${head}`;
  if (/^(body|heading|display|hero)(-|$)/.test(head)) return `font-size-${head}`;
  return `line-height-${head}`;
}

function normalizeName(
  rawPath: string,
  collectionName: string,
  prefix: string | undefined,
): string {
  let path = rawPath.replace(/\/-$/, "");
  if (STRIP_FIRST_SEGMENT.has(collectionName)) {
    const segments = path.split("/");
    const firstSeg = (segments[0] ?? "").trim().toLowerCase().replace(/\s+/g, "-");
    const firstIsCategory =
      collectionName === TYPOGRAPHY_COLLECTION && TYPO_CATEGORY_SEGMENTS.has(firstSeg);
    if (!firstIsCategory) {
      path = segments.slice(1).join("/");
    }
  }
  const head = toKebabName(path || rawPath, undefined).replace(/^--/, "");
  const rewritten = rewriteTypographyHead(head, collectionName);
  return prefix ? `--${prefix}-${rewritten}` : `--${rewritten}`;
}

function buildNameMap(
  collections: SerializedCollection[],
  prefix: string | undefined,
): NameMap {
  const map: NameMap = new Map();
  for (const c of collections) {
    for (const v of c.variables) {
      map.set(v.id, normalizeName(v.name, c.name, prefix));
    }
  }
  return map;
}

function findColorPrimitiveCollection(
  collections: SerializedCollection[],
): SerializedCollection | undefined {
  return collections.find((c) => c.name === COLOR_PRIMITIVE_COLLECTION);
}

function findSemanticColorCollection(
  collections: SerializedCollection[],
): SerializedCollection | undefined {
  return collections.find((c) => c.name === SEMANTIC_COLOR_COLLECTION);
}

function findTypographyCollection(
  collections: SerializedCollection[],
): SerializedCollection | undefined {
  return collections.find((c) => c.name === TYPOGRAPHY_COLLECTION);
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
  nameMap: NameMap,
  unit: NumberUnit,
  unresolved: { count: number },
): string {
  switch (value.kind) {
    case "color":
      return rgbaToOklchCss(value);
    case "number": {
      if (unit === "unitless") return `${Math.round(value.value * 10000) / 10000}`;
      if (unit === "px") return `${Math.round(value.value * 10000) / 10000}px`;
      const rounded = Math.round((value.value / 16) * 10000) / 10000;
      return `${rounded}rem`;
    }
    case "string":
      return value.value;
    case "boolean":
      return String(value.value);
    case "alias": {
      const targetName = nameMap.get(value.targetId);
      if (!targetName) {
        unresolved.count += 1;
        return "/* unresolved alias */";
      }
      return `var(${targetName})`;
    }
  }
}

function chooseUnit(
  collectionName: string,
  unitByCollectionName: Record<string, UnitChoice>,
): UnitChoice {
  return unitByCollectionName[collectionName] ?? "rem";
}

function headFromName(name: string, prefix: string | undefined): string {
  const noDash = name.replace(/^--/, "");
  if (prefix && noDash.startsWith(`${prefix}-`)) return noDash.slice(prefix.length + 1);
  return noDash;
}

function resolveNumberUnit(head: string, collectionUnit: UnitChoice): NumberUnit {
  if (head === "font-weight" || head.startsWith("font-weight-")) return "unitless";
  if (head === "weight" || head.startsWith("weight-")) return "unitless";
  return collectionUnit;
}

function collectionDecls(
  collection: SerializedCollection,
  modeId: string,
  nameMap: NameMap,
  prefix: string | undefined,
  unitByCollectionName: Record<string, UnitChoice>,
  unresolved: { count: number },
): Decl[] {
  const decls: Decl[] = [];
  const unit = chooseUnit(collection.name, unitByCollectionName);
  for (const v of collection.variables) {
    const name = nameMap.get(v.id);
    if (!name) continue;
    const head = headFromName(name, prefix);
    const value = v.valuesByMode[modeId];
    if (!value) continue;
    const effectiveUnit = resolveNumberUnit(head, unit);
    decls.push({ name, head, value: renderValue(value, nameMap, effectiveUnit, unresolved) });
  }
  return decls;
}

function semanticGroupKey(head: string): number {
  if (head === "surface" || head.startsWith("surface-")) return 0;
  if (head === "text" || head.startsWith("text-")) return 1;
  if (head === "border" || head.startsWith("border-")) return 2;
  if (head === "ring" || head.startsWith("ring-")) return 3;
  if (head.startsWith("chart-")) return 4;
  return Number.POSITIVE_INFINITY;
}

function primitiveGroupKey(head: string): number {
  if (head === "font" || head.startsWith("font-sans")) return 0;
  if (head.startsWith("font-mono") || head.startsWith("font-heading")) return 0;
  if (head === "font-weight" || head.startsWith("font-weight-")) return 1;
  if (head === "letter-spacing" || head.startsWith("letter-spacing-")) return 2;
  if (head === "font-size" || head.startsWith("font-size-")) return 3;
  if (head === "line-height" || head.startsWith("line-height-")) return 4;
  return 5;
}

function colorPrimitiveGroupKey(head: string): number {
  const order = [
    "neutral",
    "brand",
    "accent",
    "danger",
    "success",
    "warning",
    "black",
    "white",
    "bw",
  ];
  for (let i = 0; i < order.length; i += 1) {
    if (head === order[i] || head.startsWith(`${order[i]}-`)) return i;
  }
  return order.length;
}

function stableSortBy<T>(arr: T[], key: (x: T) => number): T[] {
  return arr
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ka = key(a.item);
      const kb = key(b.item);
      if (ka !== kb) return ka - kb;
      return a.index - b.index;
    })
    .map((x) => x.item);
}

function formatDecls(decls: Decl[], indent: string): string {
  return decls.map((d) => `${indent}${d.name}: ${d.value};`).join("\n");
}

function buildThemeInline(themeDecls: Decl[]): string | null {
  if (themeDecls.length === 0) return null;
  const lines = themeDecls.map((d) => `  --color-${d.head}: var(${d.name});`);
  return `@theme inline {\n${lines.join("\n")}\n}`;
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
      "No variable collections found in this Figma file. Create at least a Base • Color collection with Light and Dark modes, then try again.",
    );
    return { css: "", warnings, errors };
  }

  const filtered = collections.filter((c) => !/^Reference\b/i.test(c.name));
  const scoped = filtered.filter((c) => INCLUDED_COLLECTIONS.has(c.name));
  if (scoped.length === 0) {
    errors.push(
      `No matching variable collections found. Expected at least one of: ${Array.from(INCLUDED_COLLECTIONS).join(", ")}.`,
    );
    return { css: "", warnings, errors };
  }

  const colorCollection = findColorPrimitiveCollection(scoped);
  if (!colorCollection) {
    errors.push(
      `No "${COLOR_PRIMITIVE_COLLECTION}" collection detected. Stera UI Bridge requires a primitive color collection with Light and Dark modes.`,
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
  const lightModeId = detectLightModeId(colorCollection, darkModeId);

  const themeCollection = findSemanticColorCollection(scoped);
  const typoCollection = findTypographyCollection(scoped);

  const nameMap = buildNameMap(scoped, prefix);

  const unresolved = { count: 0 };

  const colorLightDecls = collectionDecls(
    colorCollection,
    lightModeId,
    nameMap,
    prefix,
    unitByCollectionName,
    unresolved,
  );
  const colorDarkDecls = collectionDecls(
    colorCollection,
    darkModeId,
    nameMap,
    prefix,
    unitByCollectionName,
    unresolved,
  );
  const typoDecls = typoCollection
    ? collectionDecls(
        typoCollection,
        typoCollection.modes[0].id,
        nameMap,
        prefix,
        unitByCollectionName,
        unresolved,
      )
    : [];
  const themeDecls = themeCollection
    ? collectionDecls(
        themeCollection,
        themeCollection.modes[0].id,
        nameMap,
        prefix,
        unitByCollectionName,
        unresolved,
      )
    : [];

  if (unresolved.count > 0) {
    warnings.push(
      `${unresolved.count} alias${unresolved.count === 1 ? "" : "es"} could not be resolved. Check that referenced variables still exist in your Figma file.`,
    );
  }

  const fontResult = emitFontDeclarations(fontAssignments, strategy, nextConvention);
  warnings.push(...fontResult.warnings);

  const fontDecls: Decl[] = fontResult.declarations
    .map((line) => {
      const match = line.match(/^\s*(--[a-z0-9-]+):\s*(.+?);?\s*$/);
      if (!match) return null;
      const name = match[1];
      const value = match[2];
      return { name, head: headFromName(name, prefix), value };
    })
    .filter((d): d is Decl => d !== null);

  const fontHeads = new Set(fontDecls.map((d) => d.head));
  const typoDeclsWithoutFonts = typoDecls.filter((d) => !fontHeads.has(d.head));

  const imports = ['@import "tailwindcss";', '@import "tw-animate-css";'];
  imports.push(...fontsourceImports(fontAssignments, strategy));

  const sortedColorLight = stableSortBy(colorLightDecls, (d) =>
    colorPrimitiveGroupKey(d.head),
  );
  const sortedColorDark = stableSortBy(colorDarkDecls, (d) =>
    colorPrimitiveGroupKey(d.head),
  );
  const sortedTypoDecls = stableSortBy(
    [...fontDecls, ...typoDeclsWithoutFonts],
    (d) => primitiveGroupKey(d.head),
  );
  const sortedThemeDecls = stableSortBy(themeDecls, (d) => semanticGroupKey(d.head));

  const themeInline = buildThemeInline(sortedThemeDecls);

  const rootSections: string[] = [];
  if (sortedColorLight.length > 0) rootSections.push(formatDecls(sortedColorLight, "  "));
  if (sortedTypoDecls.length > 0) rootSections.push(formatDecls(sortedTypoDecls, "  "));
  if (sortedThemeDecls.length > 0) rootSections.push(formatDecls(sortedThemeDecls, "  "));

  const parts: string[] = [
    imports.join("\n"),
    "",
    "@custom-variant dark (&:is(.dark *));",
    "",
  ];
  if (themeInline) {
    parts.push(themeInline, "");
  }
  parts.push(":root {", rootSections.join("\n\n"), "}", "");
  parts.push(".dark {", formatDecls(sortedColorDark, "  "), "}", "");
  parts.push(STERA_UTILITIES, "");

  return { css: parts.join("\n"), warnings, errors };
}
