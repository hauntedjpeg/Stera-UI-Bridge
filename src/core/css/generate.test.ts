import { describe, it, expect } from "vitest";
import { generateGlobalsCss } from "./generate.js";
import type { SerializedCollection } from "../../shared/messages.js";

const colorCol: SerializedCollection = {
  id: "col-color",
  name: "Colors",
  modes: [
    { id: "light", name: "Light" },
    { id: "dark", name: "Dark" },
  ],
  variables: [
    {
      id: "v-bg-surface",
      name: "bg/surface",
      type: "COLOR",
      valuesByMode: {
        light: { kind: "color", r: 1, g: 1, b: 1, a: 1 },
        dark: { kind: "color", r: 0.1, g: 0.1, b: 0.1, a: 1 },
      },
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
      collections: [colorCol],
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
    expect(css).toContain(".dark {");
    expect(css).toContain("--font-sans: var(--font-geist-sans);");
    expect(css).toContain("--bg-surface: oklch(");
  });
});
