import { describe, it, expect } from "vitest";
import { toKebabName, kebab } from "./kebab.js";

describe("toKebabName", () => {
  it("converts slash-delimited paths", () => {
    expect(toKebabName("bg/surface/hover")).toBe("--bg-surface-hover");
  });

  it("lowercases", () => {
    expect(toKebabName("BG/Surface")).toBe("--bg-surface");
  });

  it("handles spaces and collapses separators", () => {
    expect(toKebabName("Color/Brand 500")).toBe("--color-brand-500");
  });

  it("applies optional prefix", () => {
    expect(toKebabName("bg/surface", "stera")).toBe("--stera-bg-surface");
  });

  it("strips trailing/leading dashes", () => {
    expect(toKebabName("-bg-surface-")).toBe("--bg-surface");
  });
});

describe("kebab", () => {
  it("kebab-cases family names", () => {
    expect(kebab("Geist Sans")).toBe("geist-sans");
    expect(kebab("JetBrains Mono")).toBe("jetbrains-mono");
  });
});
