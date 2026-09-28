# @veridox-ai/loupe-core

## 0.3.1

### Patch Changes

- 463776b: Search stepping lands on the match again. `DocumentAdapter.setActiveSearchMatch`
  may now return a promise resolving once the activation's engine side effects
  have settled, and `ViewerStore.scrollToSearchMatch` waits it out before issuing
  its precise scroll — so an engine that scrolls on its own during activation (the
  DOCX find-cursor walk scrolls to the match's page top) can no longer cancel the
  scroll that centres the match. Synchronous adapters (PDF, image) are unaffected.

## 0.3.0

### Minor Changes

- 39a0f7b: `currentPage` now tracks the most-visible page while the user scrolls (VDX-188).

  Previously `currentPage` only changed on explicit navigation, so scrolling a
  6-page PDF to page 5 still reported "1 of 6" and next-page jumped back to 2.
  The store now derives the page from live viewport metrics on every viewport
  event, using a greatest-visible-area heuristic (new pure utility
  `computeVisiblePage`, exported alongside the other viewport utilities). A
  navigation-intent latch suppresses the feedback from programmatic smooth
  scrolls: `goToPage`, `loadDocument({ initialPage })` and
  `scrollToSearchMatch` keep their target until the scroll settles, so no
  intermediate `page-change` events leak.

  `scrollToSearchMatch` also now updates `currentPage` to the match's page on
  its precise `scrollToRect` path (previously it scrolled without ever moving
  the indicator).

  Adapters reporting aggregate page geometry (DOCX's single content rect, TIFF's
  frame-at-a-time reporting) are unaffected — tracking requires one rect per
  document page. If the DOCX iframe later reports per-page rects, tracking
  lights up with no core change.

## 0.2.0

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

## 0.1.1

### Patch Changes

- 836fc54: `closeDocument()` no longer nulls the mount element. The mount element's
  lifecycle belongs to whoever called `setMountElement` (in the React bindings,
  `ViewerSurface`'s mount/unmount effect). Previously, closing a document while
  a surface was still mounted made the next `loadDocument` throw
  `NO_MOUNT_ELEMENT`, because nothing re-registers the element.
