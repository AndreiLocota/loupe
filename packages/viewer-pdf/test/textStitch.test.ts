import { describe, expect, it } from "vitest";
import {
  enumerateMatches,
  filterTextItems,
  type StitchItem,
} from "../src/textStitch.js";

const item = (str: string, overrides: Partial<StitchItem> = {}): StitchItem => ({
  str,
  width: str.length * 10,
  height: 12,
  transform: [1, 0, 0, 1, 0, 0],
  ...overrides,
});

describe("filterTextItems", () => {
  it("keeps empty items (they can carry hasEOL) and drops marked content", () => {
    const items = filterTextItems([
      item("text"),
      item("", { hasEOL: true }),
      { type: "beginMarkedContent", tag: "P" },
    ]);
    expect(items).toHaveLength(2);
    expect(items[1]?.hasEOL).toBe(true);
  });
});

describe("enumerateMatches", () => {
  it("finds every occurrence within a single item, offsets unchanged", () => {
    const matches = enumerateMatches(
      [item("a needle and a needle")],
      "needle",
    );
    expect(matches).toHaveLength(2);
    expect(matches[0]?.slices).toEqual([{ itemIndex: 0, start: 2, end: 8 }]);
    expect(matches[1]?.slices).toEqual([{ itemIndex: 0, start: 15, end: 21 }]);
  });

  it("matches a phrase split across three items by a style change", () => {
    const matches = enumerateMatches(
      [item("POLICY "), item("EXCESS"), item(" WAIVER for this claim.")],
      "POLICY EXCESS WAIVER",
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.text).toBe("POLICY EXCESS WAIVER");
    expect(matches[0]?.slices).toEqual([
      { itemIndex: 0, start: 0, end: 7 },
      { itemIndex: 1, start: 0, end: 6 },
      { itemIndex: 2, start: 0, end: 7 },
    ]);
  });

  it("matches a phrase wrapping onto a new line via hasEOL", () => {
    const matches = enumerateMatches(
      [item("POLICY EXCESS", { hasEOL: true }), item("WAIVER for this claim.")],
      "POLICY EXCESS WAIVER",
    );
    expect(matches).toHaveLength(1);
    // The synthetic space stands in for the line break in the match text.
    expect(matches[0]?.text).toBe("POLICY EXCESS WAIVER");
    expect(matches[0]?.slices).toEqual([
      { itemIndex: 0, start: 0, end: 13 },
      { itemIndex: 1, start: 0, end: 6 },
    ]);
  });

  it("keeps the line-end flag carried by an empty item", () => {
    const matches = enumerateMatches(
      [item("POLICY EXCESS"), item("", { hasEOL: true }), item("WAIVER")],
      "EXCESS WAIVER",
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.slices).toEqual([
      { itemIndex: 0, start: 7, end: 13 },
      { itemIndex: 2, start: 0, end: 6 },
    ]);
  });

  it("collapses consecutive line-end flags into one separator", () => {
    const matches = enumerateMatches(
      [
        item("EXCESS", { hasEOL: true }),
        item("", { hasEOL: true }),
        item("WAIVER"),
      ],
      "EXCESS WAIVER",
    );
    expect(matches).toHaveLength(1);
  });

  it("does not double a real trailing space at a flagged line end", () => {
    const matches = enumerateMatches(
      [item("EXCESS ", { hasEOL: true }), item("WAIVER")],
      "EXCESS WAIVER",
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.slices).toEqual([
      { itemIndex: 0, start: 0, end: 7 },
      { itemIndex: 1, start: 0, end: 6 },
    ]);
  });

  it("drops empty slices when the query starts or ends on a separator", () => {
    const matches = enumerateMatches(
      [item("EXCESS", { hasEOL: true }), item("WAIVER")],
      "EXCESS ",
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.slices).toEqual([{ itemIndex: 0, start: 0, end: 6 }]);
    for (const slice of matches[0]?.slices ?? []) {
      expect(slice.end).toBeGreaterThan(slice.start);
      expect(slice.start).toBeGreaterThanOrEqual(0);
    }
  });

  it("is case-insensitive with original-offset fidelity", () => {
    const matches = enumerateMatches([item("NeEdLe and needle")], "NEEDLE");
    expect(matches).toHaveLength(2);
    expect(matches[0]?.text).toBe("NeEdLe");
  });

  it("finds only non-overlapping occurrences", () => {
    expect(enumerateMatches([item("aaaa")], "aaa")).toHaveLength(1);
  });

  it("finds non-overlapping occurrences across a boundary", () => {
    const matches = enumerateMatches(
      [item("needle nee"), item("dle needle")],
      "needle",
    );
    expect(matches).toHaveLength(3);
  });

  it("returns nothing for an empty query or empty items", () => {
    expect(enumerateMatches([item("text")], "")).toEqual([]);
    expect(enumerateMatches([], "text")).toEqual([]);
  });

  it("returns nothing when a whitespace query lands only on separators", () => {
    expect(
      enumerateMatches([item("a", { hasEOL: true }), item("b")], " "),
    ).toEqual([]);
  });

  it("stays linear on an item-dense page (40k flagged items)", () => {
    // Guards the stitcher against reintroducing per-boundary work over the
    // accumulated string: quadratic stitching took ~6s on this input and
    // stalls the main thread; linear stitching takes single-digit ms. The
    // minimum of three runs discards GC pauses and scheduler noise, so the
    // generous bound only trips on a complexity regression, not a slow runner.
    const items = Array.from({ length: 40_000 }, (_, i) =>
      item(`line ${i} of a dense single page export`, { hasEOL: true }),
    );
    let best = Number.POSITIVE_INFINITY;
    for (let run = 0; run < 3; run++) {
      const start = performance.now();
      expect(enumerateMatches(items, "query that matches nowhere")).toEqual([]);
      best = Math.min(best, performance.now() - start);
    }
    expect(best).toBeLessThan(1000);
  }, 30_000);
});
