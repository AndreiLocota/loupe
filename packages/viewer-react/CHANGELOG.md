# @veridox-ai/loupe-react

## 2.0.0

### Patch Changes

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

## 0.2.0

### Minor Changes

- f328c48: `useAnnotations` accepts `{ enabled }` (default true). With `enabled: false`
  the per-page annotation metadata extraction is deferred — `supported`,
  `visible`, and `setVisible` keep working — so an annotations panel can avoid
  paying the extraction cost up front for a tab the user may never open.
- 1ecdbd2: `useLoadDocument` gains a declarative form: `useLoadDocument(store, data,
{ mimeType, initialPage, initialZoom })` owns the whole load lifecycle —
  loading on mount, re-loading when `data` changes, and aborting + cancelling
  the in-flight load on change or unmount. Consumers loading from a reactive
  source (a fetched Blob) no longer need to hand-roll the effect, abort, and
  cancellation protocol. The imperative `load()` form is unchanged.
- e824426: Hooks that accept an optional explicit store (`useCapabilities`, `useLayers`,
  `useAnnotations`, `useRotation`) no longer require a `<ViewerProvider>` above
  the call site when a store is passed as an argument. They previously called
  `useViewerStore()` unconditionally and threw even with an explicit store.
  Adds `useResolvedStore(store?)` (exported) as the sanctioned argument-or-
  context resolution helper for custom hooks.

### Patch Changes

- Updated dependencies [836fc54]
  - @veridox-ai/loupe-core@0.1.1
