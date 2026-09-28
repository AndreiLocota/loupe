import type { DocxTextRunInfo } from "@silurus/ooxml/docx";
import { describe, expect, it } from "vitest";
import {
  enumerateMatches,
  sliceBounds,
  type MeasureForFont,
} from "../src/textMatch.js";

const run = (
  text: string,
  overrides: Partial<DocxTextRunInfo> = {},
): DocxTextRunInfo => ({
  text,
  x: 0,
  y: 0,
  w: text.length * 10,
  h: 12,
  fontSize: 10,
  font: "10px serif",
  ...overrides,
});

/** Fixed-width fake: every character measures 10px regardless of font. */
const measure: MeasureForFont = () => (s: string) => s.length * 10;

describe("enumerateMatches", () => {
  it("finds every occurrence within a single run", () => {
    const matches = enumerateMatches([run("a needle and a needle")], "needle");
    expect(matches).toHaveLength(2);
    expect(matches[0]?.slices).toEqual([{ runIndex: 0, start: 2, end: 8 }]);
    expect(matches[1]?.slices).toEqual([{ runIndex: 0, start: 15, end: 21 }]);
  });

  it("matches across run boundaries (formatting runs)", () => {
    const matches = enumerateMatches([run("the nee"), run("dle here")], "needle");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.text).toBe("needle");
    expect(matches[0]?.slices).toEqual([
      { runIndex: 0, start: 4, end: 7 },
      { runIndex: 1, start: 0, end: 3 },
    ]);
  });

  it("is case-insensitive with original-offset fidelity", () => {
    const matches = enumerateMatches([run("NeEdLe and needle")], "NEEDLE");
    expect(matches).toHaveLength(2);
    expect(matches[0]?.text).toBe("NeEdLe");
  });

  it("finds only non-overlapping occurrences", () => {
    expect(enumerateMatches([run("aaaa")], "aaa")).toHaveLength(1);
  });

  it("returns nothing for an empty query or empty runs", () => {
    expect(enumerateMatches([run("text")], "")).toEqual([]);
    expect(enumerateMatches([], "text")).toEqual([]);
  });
});

describe("sliceBounds", () => {
  it("positions rects by measured prefix within the run", () => {
    const runs = [run("hello needle", { x: 100, y: 50, h: 14 })];
    const [match] = enumerateMatches(runs, "needle");
    const bounds = sliceBounds(runs, match!, measure);
    expect(bounds).toEqual([{ x: 160, y: 50, width: 60, height: 14 }]);
  });

  it("emits one rect per run slice for cross-run matches", () => {
    const runs = [
      run("nee", { x: 10, y: 5 }),
      run("dle", { x: 40, y: 5 }),
    ];
    const [match] = enumerateMatches(runs, "needle");
    const bounds = sliceBounds(runs, match!, measure);
    expect(bounds).toEqual([
      { x: 10, y: 5, width: 30, height: 12 },
      { x: 40, y: 5, width: 30, height: 12 },
    ]);
  });

  it("adds per-glyph letter spacing like the engine's highlight layer", () => {
    const runs = [run("ab needle", { x: 0, letterSpacingPx: 2 })];
    const [match] = enumerateMatches(runs, "needle");
    const bounds = sliceBounds(runs, match!, measure);
    // Prefix "ab " = 30px + 3 glyphs × 2px spacing; slice = 60px + 5 gaps × 2px.
    expect(bounds).toEqual([{ x: 36, y: 0, width: 70, height: 12 }]);
  });
});
