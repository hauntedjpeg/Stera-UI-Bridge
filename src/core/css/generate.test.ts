import { describe, it, expect } from "vitest";
import { generateGlobalsCss } from "./generate.js";
import type { SerializedCollection } from "../../shared/messages.js";

const colorCol: SerializedCollection = {
  id: "col-color",
  name: "Core – Color",
  modes: [
    { id: "light", name: "Light" },
    { id: "dark", name: "Dark" },
  ],
  variables: [
    {
      id: "v-surface",
      name: "-",
      type: "COLOR",
      valuesByMode: {
        light: { kind: "color", r: 1, g: 1, b: 1, a: 1 },
        dark: { kind: "color", r: 0.1, g: 0.1, b: 0.1, a: 1 },
      },
    },
    {
      id: "v-surface-brand",
      name: "Surface/Brand/-",
      type: "COLOR",
      valuesByMode: {
        light: { kind: "color", r: 0.2, g: 0.3, b: 0.9, a: 1 },
        dark: { kind: "color", r: 0.2, g: 0.3, b: 0.9, a: 1 },
      },
    },
  ],
};

const typographyCol: SerializedCollection = {
  id: "col-typo",
  name: "Core – Typography",
  modes: [{ id: "default", name: "Default" }],
  variables: [
    {
      id: "v-size-body-sm",
      name: "Size/body/sm",
      type: "FLOAT",
      valuesByMode: { default: { kind: "number", value: 12 } },
    },
    {
      id: "v-lh-snug",
      name: "Line-height/snug",
      type: "FLOAT",
      valuesByMode: { default: { kind: "number", value: 16 } },
    },
    {
      id: "v-lh-28",
      name: "Line-height/28",
      type: "FLOAT",
      valuesByMode: { default: { kind: "number", value: 28 } },
    },
    {
      id: "v-weight-regular",
      name: "Weight/regular",
      type: "FLOAT",
      valuesByMode: { default: { kind: "number", value: 400 } },
    },
    {
      id: "v-ls-tight",
      name: "Letter-spacing/tight",
      type: "FLOAT",
      valuesByMode: { default: { kind: "number", value: -0.4 } },
    },
  ],
};

describe("generateGlobalsCss", () => {
  it("hard-fails when no collections exist", () => {
    const { errors, css } = generateGlobalsCss({
      collections: [],
      strategy: "next-font",
      nextConvention: "family-named",
      unitByCollectionName: {},
      darkModeIdByCollectionId: {},
      fontAssignments: [],
    });
    expect(errors[0]).toMatch(/No variable collections/);
    expect(css).toBe("");
  });

  it("hard-fails when color collection has no dark mode", () => {
    const noDark: SerializedCollection = {
      ...colorCol,
      modes: [{ id: "light", name: "Light" }],
      variables: [
        {
          ...colorCol.variables[0],
          valuesByMode: { light: { kind: "color", r: 1, g: 1, b: 1, a: 1 } },
        },
      ],
    };
    const { errors } = generateGlobalsCss({
      collections: [noDark],
      strategy: "next-font",
      nextConvention: "family-named",
      unitByCollectionName: {},
      darkModeIdByCollectionId: {},
      fontAssignments: [],
    });
    expect(errors[0]).toMatch(/no dark mode/i);
  });

  it("emits expected structure when colors + dark mode exist", () => {
    const { css, errors } = generateGlobalsCss({
      collections: [colorCol, typographyCol],
      strategy: "next-font",
      nextConvention: "family-named",
      unitByCollectionName: {},
      darkModeIdByCollectionId: {},
      fontAssignments: [{ role: "--font-sans", family: "Geist" }],
    });
    expect(errors).toEqual([]);
    expect(css).toContain('@import "tailwindcss";');
    expect(css).toContain("@custom-variant dark");
    expect(css).toContain("@theme inline");
    expect(css).toContain(":root {");
    expect(css).toContain("--font-sans: var(--font-geist-sans);");
    expect(css).toContain("--surface: oklch(");
  });

  it("prefixes typography tokens with font-size / font-weight / line-height", () => {
    const { css } = generateGlobalsCss({
      collections: [colorCol, typographyCol],
      strategy: "next-font",
      nextConvention: "family-named",
      unitByCollectionName: {},
      darkModeIdByCollectionId: {},
      fontAssignments: [{ role: "--font-sans", family: "Geist" }],
    });
    expect(css).toContain("--font-size-body-sm:");
    expect(css).toContain("--line-height-snug:");
    expect(css).toContain("--line-height-28:");
    expect(css).toContain("--font-weight-regular: 400;");
    expect(css).not.toMatch(/^\s*--body-sm:/m);
    expect(css).not.toMatch(/^\s*--snug:/m);
    expect(css).not.toMatch(/^\s*--weight-regular:/m);
  });

  it("wraps semantic tokens in @layer base with :root and .dark", () => {
    const { css } = generateGlobalsCss({
      collections: [colorCol, typographyCol],
      strategy: "next-font",
      nextConvention: "family-named",
      unitByCollectionName: {},
      darkModeIdByCollectionId: {},
      fontAssignments: [{ role: "--font-sans", family: "Geist" }],
    });
    expect(css).toMatch(/@layer base \{\s*:root \{/);
    expect(css).toMatch(/\.dark \{[^}]*--surface: oklch\(/);
  });

  it("emits letter-spacing in rem (not px) by default", () => {
    const { css } = generateGlobalsCss({
      collections: [colorCol, typographyCol],
      strategy: "next-font",
      nextConvention: "family-named",
      unitByCollectionName: {},
      darkModeIdByCollectionId: {},
      fontAssignments: [],
    });
    const lsLine = css.match(/--letter-spacing-tight:\s*([^;]+);/);
    expect(lsLine).not.toBeNull();
    expect(lsLine![1]).toMatch(/rem$/);
    expect(lsLine![1]).not.toMatch(/px$/);
  });

  it("utility blocks reference the renamed font-size/font-weight vars", () => {
    const { css } = generateGlobalsCss({
      collections: [colorCol, typographyCol],
      strategy: "next-font",
      nextConvention: "family-named",
      unitByCollectionName: {},
      darkModeIdByCollectionId: {},
      fontAssignments: [],
    });
    expect(css).toMatch(/@utility st-body-sm \{[^}]*var\(--font-size-body-sm\)/);
    expect(css).toMatch(/@utility st-body-sm \{[^}]*var\(--font-weight-regular\)/);
  });
});
