/** A pdf.js text-content item as the stitcher consumes it. `str` may be empty:
 * pdf.js emits empty items that exist only to carry `hasEOL`. */
export interface StitchItem {
  str: string;
  hasEOL?: boolean;
  width: number;
  height: number;
  transform: number[];
}

/** One occurrence of the query within a page, as slices over that page's
 * text items. A match that crosses an item boundary carries one slice per
 * item it touches. */
export interface ItemSliceMatch {
  text: string;
  slices: { itemIndex: number; start: number; end: number }[];
}

/**
 * Keep every real text item — including empty ones, whose `hasEOL` flag the
 * stitcher needs — and drop marked-content items, which have no `str`. All
 * consumers (search, findMatches, the text layer) must filter with this one
 * function so item indices agree across them.
 */
export function filterTextItems(items: readonly unknown[]): StitchItem[] {
  return items.filter(
    (i): i is StitchItem =>
      typeof i === "object" &&
      i !== null &&
      "str" in i &&
      typeof (i as { str: unknown }).str === "string",
  );
}

/**
 * Length-preserving case fold: a character whose lowercase form changes the
 * string length (e.g. İ → i̇) is kept as-is so offsets computed on the folded
 * text remain valid on the original. Mirrors the DOCX viewer's matcher.
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

/**
 * Enumerate every non-overlapping, case-insensitive occurrence of `query` in
 * the page's text, matching across item boundaries. pdf.js starts a new item
 * at every font change and line end, so a phrase that spans either never sits
 * inside one item; this joins the items and maps matches back to item slices.
 *
 * Line ends carry no space character — `hasEOL` flags them instead — so the
 * stitcher inserts a single synthetic space at a flagged boundary (collapsing
 * consecutive flags, and skipped when real whitespace already sits on either
 * side). Separator offsets belong to no item and produce no slice, so a query
 * space landing on one simply splits the match into the slices either side.
 */
export function enumerateMatches(
  items: readonly StitchItem[],
  query: string,
): ItemSliceMatch[] {
  if (query.length === 0) return [];

  // Accumulate parts and track the trailing character separately: testing the
  // concatenated string itself (e.g. /\s$/) forces V8 to flatten the rope at
  // every flagged boundary, which is quadratic in page text length and can
  // stall the main thread for seconds on item-dense single-page documents.
  const itemStart: number[] = Array(items.length);
  const parts: string[] = [];
  let stitchedLength = 0;
  let pendingSeparator = false;
  let tailIsWhitespace = true;
  for (let i = 0; i < items.length; i++) {
    const text = items[i]?.str ?? "";
    if (text) {
      if (
        pendingSeparator &&
        stitchedLength > 0 &&
        !tailIsWhitespace &&
        !/\s/.test(text[0] ?? "")
      ) {
        parts.push(" ");
        stitchedLength += 1;
      }
      pendingSeparator = false;
    }
    itemStart[i] = stitchedLength;
    if (text) {
      parts.push(text);
      stitchedLength += text.length;
      tailIsWhitespace = /\s/.test(text[text.length - 1] ?? "");
    }
    if (items[i]?.hasEOL) pendingSeparator = true;
  }
  const stitched = parts.join("");

  const haystack = foldCase(stitched);
  const needle = foldCase(query);
  const matches: ItemSliceMatch[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    const slices = offsetsToSlices(itemStart, items, at, at + needle.length);
    // A whitespace-only query can land entirely on synthetic separators and
    // yield no slices; such an occurrence has nothing to count or paint.
    if (slices.length > 0) {
      matches.push({ text: stitched.slice(at, at + needle.length), slices });
    }
    from = at + needle.length;
  }
  return matches;
}

/** Intersect [start, end) in stitched space with each item's span. Items are
 * not contiguous — separator offsets sit between them — so slicing must be a
 * per-item interval intersection, never a walk that assumes one item ends
 * where the next begins. */
function offsetsToSlices(
  itemStart: number[],
  items: readonly StitchItem[],
  start: number,
  end: number,
): { itemIndex: number; start: number; end: number }[] {
  // Binary search for the last item starting at or before `start`. Its own
  // intersection may still be empty (e.g. `start` sits on a separator).
  let lo = 0;
  let hi = itemStart.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((itemStart[mid] ?? 0) <= start) lo = mid;
    else hi = mid - 1;
  }
  const slices: { itemIndex: number; start: number; end: number }[] = [];
  for (let i = lo; i < items.length; i++) {
    const base = itemStart[i] ?? 0;
    if (base >= end) break;
    const sliceStart = Math.max(start, base);
    const sliceEnd = Math.min(end, base + (items[i]?.str.length ?? 0));
    if (sliceEnd > sliceStart) {
      slices.push({
        itemIndex: i,
        start: sliceStart - base,
        end: sliceEnd - base,
      });
    }
  }
  return slices;
}
