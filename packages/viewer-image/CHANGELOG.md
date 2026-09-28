# @veridox-ai/loupe-image

## 2.0.0

### Patch Changes

- Updated dependencies [39a0f7b]
  - @veridox-ai/loupe-core@0.3.0

## 1.0.0

### Patch Changes

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

- Updated dependencies [da4a567]
  - @veridox-ai/loupe-core@0.2.0

## 0.1.3

### Patch Changes

- 2dfba4d: Replace the HEIC decoder (`heic2any`) with `heic-to`'s CSP build. `heic2any` is an
  asm.js libheif build that uses `new Function` (requiring `'unsafe-eval'`), so HEIC
  never rendered under the library's documented CSP. `heic-to/csp` decodes with WASM
  libheif and no `new Function`, so HEIC now works under the documented
  `script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:`.

## 0.1.2

### Patch Changes

- ea92d60: All dependencies are now pinned to exact versions (general supply-chain
  hygiene, and the same class of protection as the pdf.js worker pin: what we
  test and publish against is exactly what consumers install). Peer dependencies
  intentionally remain ranges.

## 0.1.1

### Patch Changes

- 9894132: Fit-zoom hardening, mirroring the PDF adapter: `fit-width`/`fit-page` now
  guard against a zero-width (hidden or not-yet-laid-out) container instead of
  computing scale 0 (an invisible 0×0 image), clamp to a minimum scale, and a
  `ResizeObserver` re-applies the active fit mode when the container is resized
  or becomes visible — e.g. an image loaded inside an unselected tab now fits
  correctly when the tab is opened.
- Updated dependencies [836fc54]
  - @veridox-ai/loupe-core@0.1.1
