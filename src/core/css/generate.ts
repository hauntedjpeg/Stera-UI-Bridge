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
import { STERA_THEME_INLINE } from "./theme-map.js";
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

const INCLUDED_COLLECTIONS = new Set(["Config", "Core – Color", "Core – Typography"]);
const STRIP_FIRST_SEGMENT = new Set(["Config", "Core – Typography"]);
const FONT_ROLE_HEADS = new Set(["font-sans", "font-mono", "font-heading"]);
const TYPOGRAPHY_COLLECTION = "Core – Typography";
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
  let path = rawPath;
  if (STRIP_FIRST_SEGMENT.has(collectionName)) {
    const segments = rawPath.split("/");
    const firstSeg = (segments[0] ?? "").trim().toLowerCase();
    const firstIsCategory =
      collectionName === TYPOGRAPHY_COLLECTION && TYPO_CATEGORY_SEGMENTS.has(firstSeg);
    if (!firstIsCategory) {
      path = segments.slice(1).join("/");
    }
  }
  if (collectionName === "Core – Color" && !path.includes("/")) {
    path = `surface/${path}`;
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
  nameMap: NameMap,
  unit: NumberUnit,
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
      if (!targetName) return "/* unresolved alias */";
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

function primitiveDecls(
  collections: SerializedCollection[],
  nameMap: NameMap,
  modeIdForCollection: (c: SerializedCollection) => string,
  prefix: string | undefined,
  unitByCollectionName: Record<string, UnitChoice>,
): Decl[] {
  const decls: Decl[] = [];
  for (const c of collections) {
    const modeId = modeIdForCollection(c);
    const unit = chooseUnit(c.name, unitByCollectionName);
    for (const v of c.variables) {
      if (c.name === "Core – Color" && v.name.startsWith("Elevation/")) continue;
      const name = nameMap.get(v.id);
      if (!name) continue;
      const head = headFromName(name, prefix);
      if (FONT_ROLE_HEADS.has(head)) continue;
      const value = v.valuesByMode[modeId];
      if (!value) continue;
      const effectiveUnit = resolveNumberUnit(head, unit);
      decls.push({ name, head, value: renderValue(value, nameMap, effectiveUnit) });
    }
  }
  return decls;
}

function semanticGroupKey(head: string): number | null {
  if (head === "surface" || head.startsWith("surface-")) return 0;
  if (head === "text" || head.startsWith("text-")) return 1;
  if (head === "border" || head.startsWith("border-")) return 2;
  if (head === "ring" || head.startsWith("ring-")) return 3;
  if (head.startsWith("chart-")) return 4;
  return null;
}

function primitiveGroupKey(head: string): number {
  if (head === "font-weight" || head.startsWith("font-weight-")) return 1;
  if (head === "letter-spacing" || head.startsWith("letter-spacing-")) return 2;
  if (head === "font-size" || head.startsWith("font-size-")) return 3;
  if (head === "line-height" || head.startsWith("line-height-")) return 4;
  if (head === "font" || head.startsWith("font-")) return 0;
  return 5;
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

  const scoped = collections.filter((c) => INCLUDED_COLLECTIONS.has(c.name));
  if (scoped.length === 0) {
    errors.push(
      `No matching variable collections found. Expected at least one of: ${Array.from(INCLUDED_COLLECTIONS).join(", ")}.`,
    );
    return { css: "", warnings, errors };
  }

  const colorCollection = detectColorCollection(scoped);
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

  const nameMap = buildNameMap(scoped, prefix);

  const fontResult = emitFontDeclarations(fontAssignments, strategy, nextConvention);
  warnings.push(...fontResult.warnings);

  const imports = ['@import "tailwindcss";', '@import "tw-animate-css";'];
  imports.push(...fontsourceImports(fontAssignments, strategy));

  const lightDecls = primitiveDecls(
    scoped,
    nameMap,
    (c) => (c.id === colorCollection.id ? detectLightModeId(c, darkModeId) : c.modes[0].id),
    prefix,
    unitByCollectionName,
  );

  const darkDecls = primitiveDecls(
    [colorCollection],
    nameMap,
    () => darkModeId,
    prefix,
    unitByCollectionName,
  );

  const fontDecls: Decl[] = fontResult.declarations.map((line) => {
    const match = line.match(/^\s*(--[a-z0-9-]+):\s*(.+?);?\s*$/);
    if (!match) return { name: line.trim(), head: "font", value: "" };
    const name = match[1];
    const value = match[2];
    return { name, head: headFromName(name, prefix), value };
  });

  const primitives = stableSortBy(
    [...fontDecls, ...lightDecls.filter((d) => semanticGroupKey(d.head) === null)],
    (d) => primitiveGroupKey(d.head),
  );
  const lightSemantics = stableSortBy(
    lightDecls.filter((d) => semanticGroupKey(d.head) !== null),
    (d) => semanticGroupKey(d.head) as number,
  );
  const darkSemantics = stableSortBy(
    darkDecls.filter((d) => semanticGroupKey(d.head) !== null),
    (d) => semanticGroupKey(d.head) as number,
  );

  const parts: string[] = [
    imports.join("\n"),
    "",
    "@custom-variant dark (&:is(.dark *));",
    "",
    STERA_THEME_INLINE,
    "",
    ":root {",
    formatDecls(primitives, "  "),
    "}",
    "",
    "@layer base {",
    "  :root {",
    formatDecls(lightSemantics, "    "),
    "  }",
    "",
    "  .dark {",
    formatDecls(darkSemantics, "    "),
    "  }",
    "}",
    "",
    STERA_UTILITIES,
    "",
  ];

  return { css: parts.join("\n"), warnings, errors };
}
