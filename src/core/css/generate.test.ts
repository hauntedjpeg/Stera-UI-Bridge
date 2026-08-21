import { describe, it, expect } from "vitest";
import { generateGlobalsCss } from "./generate.js";
import type {
  SerializedCollection,
  SerializedTextStyle,
} from "../../shared/messages.js";

const basePrimitives: SerializedCollection = {
  id: "col-base-color",
  name: "Color",
  modes: [
    { id: "light", name: "Light" },
    { id: "dark", name: "Dark" },
  ],
  variables: [
    {
      id: "v-neutral-1",
      name: "Neutral/1",
      type: "COLOR",
      valuesByMode: {
        light: { kind: "color", r: 0.99, g: 0.99, b: 0.99, a: 1 },
        dark: { kind: "color", r: 0.05, g: 0.05, b: 0.05, a: 1 },
      },
    },
    {
      id: "v-neutral-12",
      name: "Neutral/12",
      type: "COLOR",
      valuesByMode: {
        light: { kind: "color", r: 0.05, g: 0.05, b: 0.05, a: 1 },
        dark: { kind: "color", r: 0.99, g: 0.99, b: 0.99, a: 1 },
      },
    },
    {
      id: "v-brand-9",
      name: "Brand/9",
      type: "COLOR",
      valuesByMode: {
        light: { kind: "color", r: 0.2, g: 0.3, b: 0.9, a: 1 },
        dark: { kind: "color", r: 0.4, g: 0.5, b: 1.0, a: 1 },
      },
    },
  ],
};

const themeSemantic: SerializedCollection = {
  id: "col-theme-color",
  name: "Theme",
  modes: [{ id: "value", name: "Value" }],
  variables: [
    {
      id: "v-surface",
      name: "Surface/-",
      type: "COLOR",
      valuesByMode: {
        value: { kind: "alias", targetId: "v-neutral-1" },
      },
    },
    {
      id: "v-surface-brand",
      name: "Surface/Brand/-",
      type: "COLOR",
      valuesByMode: {
        value: { kind: "alias", targetId: "v-brand-9" },
      },
    },
    {
      id: "v-text",
      name: "Text/-",
      type: "COLOR",
      valuesByMode: {
        value: { kind: "alias", targetId: "v-neutral-12" },
      },
    },
  ],
};

const baseTypography: SerializedCollection = {
  id: "col-base-typo",
  name: "Typography",
  modes: [{ id: "default", name: "Default" }],
  variables: [
    {
      id: "v-font-sans",
      name: "Font/Sans",
      type: "STRING",
      valuesByMode: { default: { kind: "string", value: "'Geist'" } },
    },
    {
      id: "v-size-body-sm",
      name: "Size/Body-SM",
      type: "FLOAT",
      valuesByMode: { default: { kind: "number", value: 12 } },
    },
    {
      id: "v-lh-snug",
      name: "Line Height/Snug",
      type: "FLOAT",
      valuesByMode: { default: { kind: "number", value: 16 } },
    },
    {
      id: "v-lh-28",
      name: "Line Height/28",
      type: "FLOAT",
      valuesByMode: { default: { kind: "number", value: 28 } },
    },
    {
      id: "v-weight-regular",
      name: "Weight/Regular",
      type: "FLOAT",
      valuesByMode: { default: { kind: "number", value: 400 } },
    },
    {
      id: "v-weight-medium",
      name: "Weight/Medium",
      type: "FLOAT",
      valuesByMode: { default: { kind: "number", value: 500 } },
    },
    {
      id: "v-weight-strong",
      name: "Weight/Strong",
      type: "FLOAT",
      valuesByMode: { default: { kind: "number", value: 500 } },
    },
    {
      id: "v-ls-tight",
      name: "Letter Spacing/Tight",
      type: "FLOAT",
      valuesByMode: { default: { kind: "number", value: -0.4 } },
    },
  ],
};

const referenceDimension: SerializedCollection = {
  id: "col-ref-dim",
  name: "Reference",
  modes: [{ id: "default", name: "Default" }],
  variables: [
    {
      id: "v-spacing-4",
      name: "Spacing/4",
      type: "FLOAT",
      valuesByMode: { default: { kind: "number", value: 4 } },
    },
    {
      id: "v-radii-md",
      name: "Radii/MD",
      type: "FLOAT",
      valuesByMode: { default: { kind: "number", value: 6 } },
    },
    {
      id: "v-radii-10",
      name: "Radii/10",
      type: "FLOAT",
      valuesByMode: { default: { kind: "number", value: 10 } },
    },
    {
      id: "v-radii-full",
      name: "Radii/Full",
      type: "FLOAT",
      valuesByMode: { default: { kind: "number", value: 9999 } },
    },
  ],
};

const baseOptions = {
  strategy: "next-font" as const,
  nextConvention: "family-named" as const,
  unitByCollectionName: {},
  darkModeIdByCollectionId: {},
  fontAssignments: [],
};

const headingSmStyle: SerializedTextStyle = {
  id: "S:1",
  name: "Heading/SM",
  fontFamily: "Geist",
  fontStyle: "Medium",
  fontSize: 20,
  lineHeight: { unit: "PIXELS", value: 28 },
  letterSpacing: { unit: "PIXELS", value: -0.4 },
  boundVariables: {
    fontFamily: "v-font-sans",
    fontSize: "v-size-body-sm",
    lineHeight: "v-lh-28",
    fontWeight: "v-weight-strong",
    letterSpacing: "v-ls-tight",
  },
};

describe("generateGlobalsCss", () => {
  it("hard-fails when no collections exist", () => {
    const { errors, css } = generateGlobalsCss({
      ...baseOptions,
      collections: [],
    });
    expect(errors[0]).toMatch(/No variable collections/);
    expect(css).toBe("");
  });

  it("hard-fails when Color has no dark mode", () => {
    const noDark: SerializedCollection = {
      ...basePrimitives,
      modes: [{ id: "light", name: "Light" }],
      variables: basePrimitives.variables.map((v) => ({
        ...v,
        valuesByMode: { light: v.valuesByMode.light },
      })),
    };
    const { errors } = generateGlobalsCss({
      ...baseOptions,
      collections: [noDark, themeSemantic, baseTypography],
    });
    expect(errors[0]).toMatch(/no dark mode/i);
  });

  it("hard-fails when Color is missing entirely", () => {
    const { errors } = generateGlobalsCss({
      ...baseOptions,
      collections: [themeSemantic, baseTypography],
    });
    expect(errors[0]).toMatch(/"Color"/);
  });

  it("emits expected top-level structure", () => {
    const { css, errors } = generateGlobalsCss({
      ...baseOptions,
      collections: [basePrimitives, themeSemantic, baseTypography],
    });
    expect(errors).toEqual([]);
    expect(css).toContain('@import "tailwindcss";');
    expect(css).toContain("@custom-variant dark");
    expect(css).toContain("@theme inline");
    expect(css).toContain(":root {");
    expect(css).toContain(".dark {");
  });

  it("strips trailing /- segment from semantic paths", () => {
    const { css } = generateGlobalsCss({
      ...baseOptions,
      collections: [basePrimitives, themeSemantic, baseTypography],
    });
    expect(css).toMatch(/--surface:\s*var\(--neutral-1\);/);
    expect(css).toMatch(/--surface-brand:\s*var\(--brand-9\);/);
    expect(css).toMatch(/--text:\s*var\(--neutral-12\);/);
    expect(css).not.toMatch(/--surface-:/);
    expect(css).not.toMatch(/--surface-brand-:/);
  });

  it("excludes any collection prefixed Reference", () => {
    const { css } = generateGlobalsCss({
      ...baseOptions,
      collections: [basePrimitives, themeSemantic, baseTypography, referenceDimension],
    });
    expect(css).not.toContain("--spacing-4");
  });

  describe("Reference radii", () => {
    const withReference = [
      basePrimitives,
      themeSemantic,
      baseTypography,
      referenceDimension,
    ];

    it("emits only radii Tailwind does not already define", () => {
      const { css } = generateGlobalsCss({ ...baseOptions, collections: withReference });
      const block = css.match(/@theme \{([\s\S]*?)\n\}/)![1];
      expect(block).toMatch(/--radius-10:\s*10px;/);
      expect(css).not.toContain("--radius-md");
      expect(css).not.toContain("--radius-full");
    });

    it("emits a radius whose value diverges from the Tailwind default", () => {
      const overridden: SerializedCollection = {
        ...referenceDimension,
        variables: referenceDimension.variables.map((v) =>
          v.id === "v-radii-md"
            ? { ...v, valuesByMode: { default: { kind: "number" as const, value: 5 } } }
            : v,
        ),
      };
      const { css } = generateGlobalsCss({
        ...baseOptions,
        collections: [basePrimitives, themeSemantic, baseTypography, overridden],
      });
      expect(css).toMatch(/--radius-md:\s*5px;/);
    });

    it("omits the @theme block entirely when every radius matches Tailwind", () => {
      const tailwindOnly: SerializedCollection = {
        ...referenceDimension,
        variables: referenceDimension.variables.filter((v) => v.id !== "v-radii-10"),
      };
      const { css } = generateGlobalsCss({
        ...baseOptions,
        collections: [basePrimitives, themeSemantic, baseTypography, tailwindOnly],
      });
      expect(css).not.toMatch(/@theme \{/);
      expect(css).toContain("@theme inline");
    });

    it("does not apply the user prefix to radius variables", () => {
      const { css } = generateGlobalsCss({
        ...baseOptions,
        prefix: "stera",
        collections: withReference,
      });
      expect(css).toMatch(/--radius-10:\s*10px;/);
      expect(css).not.toContain("--stera-radius-10");
    });

    it("places the @theme block after @theme inline and before :root", () => {
      const { css } = generateGlobalsCss({ ...baseOptions, collections: withReference });
      expect(css.indexOf("@theme inline")).toBeLessThan(css.indexOf("@theme {"));
      expect(css.indexOf("@theme {")).toBeLessThan(css.indexOf(":root {"));
    });

    it("warns and skips a radius that does not resolve to a number", () => {
      const aliased: SerializedCollection = {
        ...referenceDimension,
        variables: referenceDimension.variables.map((v) =>
          v.id === "v-radii-10"
            ? {
                ...v,
                valuesByMode: {
                  default: { kind: "alias" as const, targetId: "v-missing" },
                },
              }
            : v,
        ),
      };
      const { css, warnings } = generateGlobalsCss({
        ...baseOptions,
        collections: [basePrimitives, themeSemantic, baseTypography, aliased],
      });
      expect(css).not.toContain("--radius-10");
      expect(warnings.some((w) => /Radii\/10/.test(w))).toBe(true);
    });
  });

  it("emits Color light primitives in :root and dark overrides in .dark", () => {
    const { css } = generateGlobalsCss({
      ...baseOptions,
      collections: [basePrimitives, themeSemantic, baseTypography],
    });
    const rootMatch = css.match(/:root \{([\s\S]*?)\n\}/);
    const darkMatch = css.match(/\.dark \{([\s\S]*?)\n\}/);
    expect(rootMatch).not.toBeNull();
    expect(darkMatch).not.toBeNull();
    const rootBody = rootMatch![1];
    const darkBody = darkMatch![1];
    expect(rootBody).toMatch(/--neutral-1:\s*oklch\(/);
    expect(rootBody).toMatch(/--brand-9:\s*oklch\(/);
    expect(darkBody).toMatch(/--neutral-1:\s*oklch\(/);
    expect(darkBody).toMatch(/--brand-9:\s*oklch\(/);
  });

  it(".dark contains only Color primitives, no semantic or typography vars", () => {
    const { css } = generateGlobalsCss({
      ...baseOptions,
      collections: [basePrimitives, themeSemantic, baseTypography],
    });
    const darkMatch = css.match(/\.dark \{([\s\S]*?)\n\}/);
    const darkBody = darkMatch![1];
    expect(darkBody).not.toMatch(/--surface\b/);
    expect(darkBody).not.toMatch(/--text\b/);
    expect(darkBody).not.toMatch(/--font-size-/);
    expect(darkBody).not.toMatch(/--font-weight-/);
  });

  it("Theme aliases resolve to var(--primitive) references", () => {
    const { css } = generateGlobalsCss({
      ...baseOptions,
      collections: [basePrimitives, themeSemantic, baseTypography],
    });
    expect(css).toMatch(/--surface:\s*var\(--neutral-1\);/);
    expect(css).not.toMatch(/unresolved alias/);
  });

  it("dynamically generates @theme inline from Theme only", () => {
    const { css } = generateGlobalsCss({
      ...baseOptions,
      collections: [basePrimitives, themeSemantic, baseTypography],
    });
    const themeMatch = css.match(/@theme inline \{([\s\S]*?)\n\}/);
    expect(themeMatch).not.toBeNull();
    const themeBody = themeMatch![1];
    expect(themeBody).toMatch(/--color-surface:\s*var\(--surface\);/);
    expect(themeBody).toMatch(/--color-surface-brand:\s*var\(--surface-brand\);/);
    expect(themeBody).toMatch(/--color-text:\s*var\(--text\);/);
    expect(themeBody).not.toMatch(/--font-/);
    expect(themeBody).not.toMatch(/--line-height-/);
    expect(themeBody).not.toMatch(/--letter-spacing-/);
    const colorLines = themeBody.match(/--color-[a-z0-9-]+:/g) ?? [];
    expect(colorLines.length).toBe(themeSemantic.variables.length);
  });

  it("prefixes typography tokens with font-size / font-weight / line-height / letter-spacing", () => {
    const { css } = generateGlobalsCss({
      ...baseOptions,
      collections: [basePrimitives, themeSemantic, baseTypography],
    });
    expect(css).toContain("--font-size-body-sm:");
    expect(css).toContain("--line-height-snug:");
    expect(css).toContain("--line-height-28:");
    expect(css).toContain("--font-weight-regular: 400;");
    expect(css).toContain("--letter-spacing-tight:");
    expect(css).not.toMatch(/^\s*--body-sm:/m);
    expect(css).not.toMatch(/^\s*--snug:/m);
    expect(css).not.toMatch(/^\s*--weight-regular:/m);
  });

  it("emits letter-spacing in rem (not px) by default", () => {
    const { css } = generateGlobalsCss({
      ...baseOptions,
      collections: [basePrimitives, themeSemantic, baseTypography],
    });
    const rootBody = css.match(/:root \{([\s\S]*?)\n\}/)![1];
    const lsLine = rootBody.match(/--letter-spacing-tight:\s*([^;]+);/);
    expect(lsLine).not.toBeNull();
    expect(lsLine![1]).toMatch(/rem$/);
    expect(lsLine![1]).not.toMatch(/px$/);
  });

  it("utility blocks reference the renamed font-size/font-weight vars", () => {
    const { css } = generateGlobalsCss({
      ...baseOptions,
      collections: [basePrimitives, themeSemantic, baseTypography],
    });
    expect(css).toMatch(/@utility st-body-sm \{[^}]*var\(--font-size-body-sm\)/);
    expect(css).toMatch(/@utility st-body-sm \{[^}]*var\(--font-weight-regular\)/);
  });

  it("builds utilities from text styles, using their bound weight", () => {
    const { css, warnings } = generateGlobalsCss({
      ...baseOptions,
      collections: [basePrimitives, themeSemantic, baseTypography],
      textStyles: [headingSmStyle],
    });
    expect(css).toMatch(
      /@utility st-heading-sm \{[^}]*font-weight: var\(--font-weight-strong\);/,
    );
    expect(css).not.toContain("var(--font-weight-medium)");
    expect(warnings).toEqual([]);
  });

  it("keeps the base utilities and drops the built-in typography blocks", () => {
    const { css } = generateGlobalsCss({
      ...baseOptions,
      collections: [basePrimitives, themeSemantic, baseTypography],
      textStyles: [headingSmStyle],
    });
    expect(css).toContain("@utility scrollbar-hide");
    expect(css).toContain("@layer base {");
    expect(css).not.toContain("@utility st-hero-xl");
  });

  it("falls back to the built-in utilities and warns when there are no text styles", () => {
    const { css, warnings } = generateGlobalsCss({
      ...baseOptions,
      collections: [basePrimitives, themeSemantic, baseTypography],
      textStyles: [],
    });
    expect(css).toContain("@utility st-hero-xl");
    expect(warnings.some((w) => /No local text styles found/.test(w))).toBe(true);
  });

  it("warns when a utility references a variable the export does not emit", () => {
    const { warnings } = generateGlobalsCss({
      ...baseOptions,
      collections: [basePrimitives, themeSemantic, baseTypography],
      textStyles: [],
    });
    // The built-in fallback references sizes this fixture does not define.
    expect(
      warnings.some((w) => /reference.*not in this export.*--font-size-hero-xl/.test(w)),
    ).toBe(true);
  });

  it("Typography font roles emit without fontAssignments", () => {
    const { css } = generateGlobalsCss({
      ...baseOptions,
      collections: [basePrimitives, themeSemantic, baseTypography],
    });
    expect(css).toMatch(/--font-sans:\s*'Geist';/);
  });

  const baseTypographyPlain: SerializedCollection = {
    ...baseTypography,
    variables: baseTypography.variables.map((v) =>
      v.id === "v-font-sans"
        ? { ...v, valuesByMode: { default: { kind: "string", value: "Geist" } } }
        : v,
    ),
  };

  it("next-font strategy overrides raw Typography font roles", () => {
    const { css } = generateGlobalsCss({
      ...baseOptions,
      strategy: "next-font",
      collections: [basePrimitives, themeSemantic, baseTypographyPlain],
      fontAssignments: [
        { role: "--font-sans", family: "Geist" },
        { role: "--font-heading", family: "Geist" },
      ],
    });
    const rootBody = css.match(/:root \{([\s\S]*?)\n\}/)![1];
    const fontSansLines = rootBody.match(/^\s*--font-sans:[^\n]*$/gm) ?? [];
    expect(fontSansLines.length).toBe(1);
    expect(fontSansLines[0]).toContain("var(--font-geist-sans)");
    expect(rootBody).not.toMatch(/--font-sans:\s*Geist;/);
    expect(rootBody).toMatch(/--font-heading:\s*var\(--font-geist-sans\);/);
  });

  it("fontsource-variable strategy overrides raw Typography and emits the @import", () => {
    const { css } = generateGlobalsCss({
      ...baseOptions,
      strategy: "fontsource-variable",
      collections: [basePrimitives, themeSemantic, baseTypographyPlain],
      fontAssignments: [{ role: "--font-sans", family: "Geist" }],
    });
    const rootBody = css.match(/:root \{([\s\S]*?)\n\}/)![1];
    expect(rootBody).toMatch(/--font-sans:\s*'Geist Variable', sans-serif;/);
    expect(rootBody).not.toMatch(/--font-sans:\s*Geist;/);
    expect(css).toMatch(/@import "@fontsource-variable\/geist";/);
  });

  it("raw strategy emits the fallback stack instead of the bare Typography value", () => {
    const { css } = generateGlobalsCss({
      ...baseOptions,
      strategy: "raw",
      collections: [basePrimitives, themeSemantic, baseTypographyPlain],
      fontAssignments: [{ role: "--font-sans", family: "Geist" }],
    });
    const rootBody = css.match(/:root \{([\s\S]*?)\n\}/)![1];
    const fontSansLines = rootBody.match(/^\s*--font-sans:[^\n]*$/gm) ?? [];
    expect(fontSansLines.length).toBe(1);
    expect(fontSansLines[0]).toMatch(/Geist,\s*sans-serif/);
  });

  it("fontAssignments fills roles missing from Typography", () => {
    const { css } = generateGlobalsCss({
      ...baseOptions,
      collections: [basePrimitives, themeSemantic, baseTypography],
      fontAssignments: [{ role: "--font-mono", family: "JetBrains Mono" }],
    });
    const rootBody = css.match(/:root \{([\s\S]*?)\n\}/)![1];
    expect(rootBody).toMatch(/--font-sans:\s*'Geist';/);
    expect(rootBody).toMatch(/--font-mono:\s*var\(--font-jetbrains-mono\);/);
  });
});
