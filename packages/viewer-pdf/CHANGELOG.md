# @veridox-ai/loupe-pdf

## 2.0.0

### Patch Changes

- bc7350f: Security dependency bumps: pdfjs-dist 6.1.200 → 6.3.289 in loupe-pdf
  (clears GHSA-wgrm-67xf-hhpq and GHSA-hq66-cqwq-w95j, both fixed in 6.2.108;
  we take the latest 6.x, and the bundled pdf.worker is rebuilt from the same
  version so API and worker stay in lockstep) and dompurify 3.4.11 → 3.4.15 in
  loupe-docx (clears GHSA-c2j3-45gr-mqc4 and GHSA-55q2-fjhq-7xh7).
- Updated dependencies [39a0f7b]
  - @veridox-ai/loupe-core@0.3.0

## 1.0.0

### Minor Changes

- da4a567: Scroll to the exact search match, not just its page (VDX-175).

  New API: adapter capability `scrollToRect` with optional `scrollToRect()` /
  `setActiveSearchMatch()` methods; `ViewerStore.scrollToSearchMatch(index?, opts?)`
  plus automatic scrolling on search commit and next/previous; pure
  `computeScrollTarget` / `unionRects` viewport utilities; `scrollToMatch` on
  `useSearch` / `scrollToSearchMatch` on `useViewer`. The active match is styled
  distinctly via the `loupe-search-highlight-active` class (PDF). Matches without
  geometry (`bounds: []`, e.g. DOCX's iframe-side search) are never navigated
  from, so DOCX behaviour is unchanged.

  Breaking for adapter implementors (0.x): `AdapterCapabilities` now requires
  `scrollToRect`.

  Behaviour changes in loupe-pdf:

  - `search()` bounds are now native-unit, top-left-origin and narrowed to the
    matched substring (previously raw PDF baseline coordinates and the full run's
    width), matching the `findMatches()` contract.
  - Matches are non-overlapping (advance by the match length), so counters can
    report fewer — correct — matches, and they now align one-to-one with painted
    highlights.
  - Every page container is pre-sized from measured page dimensions (page-1
    estimate first, corrected by a background pass), and `goToPage` scrolls the
    internal container precisely instead of `scrollIntoView` — navigation now
    lands on the right page on documents of any length. Store search state is
    also reset on document load, so stale matches can't navigate a new document.

### Patch Changes

- Updated dependencies [da4a567]
  - @veridox-ai/loupe-core@0.2.0

## 0.1.2

### Patch Changes

- 8408a37: Pin `pdfjs-dist` to an exact version. The adapter ships a worker file frozen
  at publish time from this repo's locked pdfjs-dist, but the dependency was
  declared as a caret range — so a consumer's install could resolve a newer
  main-thread API than the bundled worker, and pdf.js hard-fails on the
  mismatch ("The API version X does not match the Worker version Y"), rendering
  nothing. With an exact pin, the API and the shipped worker always match;
  bumping pdf.js now updates the pin and the worker together.

## 0.1.1

### Patch Changes

- b883546: Thumbnail renders are now serialized inside the adapter. Requesting many
  thumbnails at once (e.g. a per-page `useThumbnail` in a thumbnail rail) used
  to fire N concurrent PDF.js render tasks that competed with the visible page
  render; requests now queue and stream in order. Failures don't poison the
  queue.
- Updated dependencies [836fc54]
  - @veridox-ai/loupe-core@0.1.1
