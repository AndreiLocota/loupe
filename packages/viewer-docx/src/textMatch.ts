import type { DocumentRect } from "@veridox-ai/loupe-core";
import type { DocxTextRunInfo } from "@silurus/ooxml/docx";

/** One occurrence of the query within a page, as slices over that page's runs. */
export interface RunSliceMatch {
  text: string;
  slices: { runIndex: number; start: number; end: number }[];
}

/**
 * Length-preserving case fold: a character whose lowercase form changes the
 * string length (e.g. İ → i̇) is kept as-is so slice offsets computed on the
 * folded text remain valid on the original.
 *
 * This scanner is a faithful port of @silurus/ooxml's internal find matcher
 * (fold → concatenate runs → non-overlapping indexOf scan → run slices). It
 * must stay semantically identical: search() pairs the library's match list
 * (which has no geometry) with this enumeration by per-page ordinal, so any
 * divergence would attach bounds to the wrong occurrence.
 */
function foldCase(s: string): string {
  const lower = s.toLowerCase();
  if (lower.length === s.length) return lower;
  let out = "";
  for (const ch of s) {
    const l = ch.toLowerCase();
    out += l.length === ch.length ? l : ch;
  }
  return out;
}

/** Enumerate every non-overlapping, case-insensitive occurrence of `query`
 * in the page's runs (concatenated in run order, no separators — matches may
 * span run boundaries). */
export function enumerateMatches(
  runs: readonly DocxTextRunInfo[],
  query: string,
): RunSliceMatch[] {
  if (query.length === 0) return [];

  const runStart: number[] = Array(runs.length);
  let text = "";
  for (let i = 0; i < runs.length; i++) {
    runStart[i] = text.length;
    text += runs[i]?.text ?? "";
  }

  const haystack = foldCase(text);
  const needle = foldCase(query);
  const matches: RunSliceMatch[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    const slices = offsetsToSlices(runStart, runs, at, at + needle.length);
    matches.push({
      text: slices
        .map((s) => runs[s.runIndex]?.text.slice(s.start, s.end) ?? "")
        .join(""),
      slices,
    });
    from = at + needle.length;
  }
  return matches;
}

function offsetsToSlices(
  runStart: number[],
  runs: readonly DocxTextRunInfo[],
  start: number,
  end: number,
): { runIndex: number; start: number; end: number }[] {
  // Binary search for the run containing `start`.
  let lo = 0;
  let hi = runStart.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((runStart[mid] ?? 0) <= start) lo = mid;
    else hi = mid - 1;
  }
  const slices: { runIndex: number; start: number; end: number }[] = [];
  let pos = start;
  let run = lo;
  while (pos < end && run < runs.length) {
    const base = runStart[run] ?? 0;
    const runEnd =
      run + 1 < runs.length
        ? (runStart[run + 1] ?? base)
        : base + (runs[run]?.text.length ?? 0);
    const sliceEnd = Math.min(end, runEnd);
    const localStart = pos - base;
    const localEnd = sliceEnd - base;
    if (localEnd > localStart) {
      slices.push({ runIndex: run, start: localStart, end: localEnd });
    }
    pos = sliceEnd;
    run++;
  }
  return slices;
}

/** Measure per-font text widths on a shared offscreen 2D context. */
export type MeasureForFont = (font: string) => (s: string) => number;

export function createMeasureForFont(): MeasureForFont {
  let ctx: CanvasRenderingContext2D | null = null;
  const perFont = new Map<string, (s: string) => number>();
  return (font: string) => {
    const cached = perFont.get(font);
    if (cached) return cached;
    const measure = (s: string): number => {
      if (!ctx) {
        ctx = document.createElement("canvas").getContext("2d");
        if (!ctx) return 0;
      }
      ctx.font = font;
      return ctx.measureText(s).width;
    };
    perFont.set(font, measure);
    return measure;
  };
}

const codePointCount = (s: string): number => [...s].length;

/**
 * Rectangles for one match, in the page's native (scale-1) CSS-pixel space,
 * top-left origin — the space SearchMatch.bounds and projectRect() consume.
 * One rect per run slice, positioned by measuring the run's text with its own
 * font plus per-glyph letter spacing (mirroring the library's highlight
 * layer). Vertical-CJK compression is not applied, so those rare runs may
 * report slightly wide boxes.
 */
export function sliceBounds(
  runs: readonly DocxTextRunInfo[],
  match: RunSliceMatch,
  measureForFont: MeasureForFont,
): DocumentRect[] {
  const rects: DocumentRect[] = [];
  for (const slice of match.slices) {
    const run = runs[slice.runIndex];
    if (!run) continue;
    const measure = measureForFont(run.font);
    const start = Math.max(0, Math.min(slice.start, run.text.length));
    const end = Math.max(start, Math.min(slice.end, run.text.length));
    const spacing = run.letterSpacingPx ?? 0;
    const prefixGlyphs = codePointCount(run.text.slice(0, start));
    const sliceGlyphs = codePointCount(run.text.slice(start, end));
    const x = measure(run.text.slice(0, start)) + prefixGlyphs * spacing;
    const width =
      measure(run.text.slice(start, end)) +
      Math.max(0, sliceGlyphs - 1) * spacing;
    if (width <= 0) continue;
    rects.push({ x: run.x + x, y: run.y, width, height: run.h });
  }
  return rects;
}
