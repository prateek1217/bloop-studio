import { describe, it, expect } from "vitest";
import { filterThemes } from "./searchThemes";
import type { SubtitleTheme } from "@/types";

function theme(overrides: Partial<SubtitleTheme>): SubtitleTheme {
  return {
    id: overrides.id ?? "t",
    name: "Test",
    font: "var(--font-inter)",
    fontSize: 60,
    fontWeight: 700,
    textColor: "#fff",
    highlightColor: "#fff",
    animation: "none",
    wordHighlight: false,
    dynamicWordSize: false,
    uppercase: false,
    depthMode: "auto",
    positionStrategy: "auto",
    ...overrides,
  };
}

const THEMES = [
  theme({ id: "bold", name: "Bold", animation: "pop", depthMode: "auto" }),
  theme({ id: "glitch", name: "Glitch", animation: "glitch", depthMode: "behind_person" }),
  theme({ id: "vhs", name: "VHS", animation: "typewriter", depthMode: "front" }),
  theme({ id: "aurora", name: "Aurora", animation: "wave", depthMode: "auto" }),
];

describe("filterThemes", () => {
  it("returns everything for an empty query", () => {
    expect(filterThemes(THEMES, "")).toHaveLength(4);
    expect(filterThemes(THEMES, "   ")).toHaveLength(4);
  });

  it("matches plain text against the theme name, case-insensitively", () => {
    const result = filterThemes(THEMES, "glit");
    expect(result.map((t) => t.id)).toEqual(["glitch"]);
    expect(filterThemes(THEMES, "GLITCH").map((t) => t.id)).toEqual(["glitch"]);
  });

  it("matches plain text against animation and depth too", () => {
    expect(filterThemes(THEMES, "behind_person").map((t) => t.id)).toEqual(["glitch"]);
    expect(filterThemes(THEMES, "wave").map((t) => t.id)).toEqual(["aurora"]);
  });

  it("supports an explicit /regex/ pattern with alternation", () => {
    const result = filterThemes(THEMES, "/glitch|vhs/");
    expect(result.map((t) => t.id).sort()).toEqual(["glitch", "vhs"]);
  });

  it("supports a bare regex without slashes", () => {
    // Haystack is "name animation depthMode", so anchoring to name alone
    // needs ^Name to match the start, not $ at the end.
    const result = filterThemes(THEMES, "^(Bold|Aurora)");
    expect(result.map((t) => t.id).sort()).toEqual(["aurora", "bold"]);
  });

  it("falls back to plain substring matching on invalid regex instead of throwing", () => {
    expect(() => filterThemes(THEMES, "glitch(")).not.toThrow();
    expect(filterThemes(THEMES, "glitch(").map((t) => t.id)).toEqual([]);
    expect(filterThemes(THEMES, "vhs").map((t) => t.id)).toEqual(["vhs"]);
  });

  it("returns no themes when nothing matches", () => {
    expect(filterThemes(THEMES, "nonexistent-theme-xyz")).toEqual([]);
  });
});
