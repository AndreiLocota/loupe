# @veridox-ai/loupe-docx

## 3.0.2

### Patch Changes

- 7a3f64a: Pin the scroller during the search-match activation walk. The engine scrolls to the match's page top on every cursor step, which painted as an up-then-down lurch before the store's precise scroll-to-match; each step's jump is now undone before anything paints, so the precise scroll is the only one the user sees.

## 3.0.1

### Patch Changes

- 463776b: Search stepping lands on the match again. `DocumentAdapter.setActiveSearchMatch`
  may now return a promise resolving once the activation's engine side effects
  have settled, and `ViewerStore.scrollToSearchMatch` waits it out before issuing
  its precise scroll — so an engine that scrolls on its own during activation (the
  DOCX find-cursor walk scrolls to the match's page top) can no longer cancel the
  scroll that centres the match. Synchronous adapters (PDF, image) are unaffected.
- Updated dependencies [463776b]
  - @veridox-ai/loupe-core@0.3.1

## 3.0.0

### Major Changes

- 2e56585: Replace the DOCX rendering engine: docx-preview (HTML in a sandboxed iframe) → @silurus/ooxml 0.86.0 (Rust→WASM, canvas rendering, Web Worker parsing). The public API is unchanged — upgrading requires only a package bump — but rendering output, runtime requirements and the security model change materially.

  **Engine and architecture**

  - Documents render to canvas with real pagination; the sandboxed iframe, postMessage protocol, DOMPurify pass and bundled `iframeScript.js` are gone. Document content never becomes live markup.
  - Parsing runs in a Web Worker; the WASM binary and worker ship inside `@silurus/ooxml` and resolve via `import.meta.url` (Vite/webpack 5/Next.js need no config). New `wasmUrl` option for bundlers that can't emit those assets.
  - `iframeScriptUrl` is now a deprecated no-op (kept so existing call sites compile; removed in 4.0).
  - Browser floor rises to evergreen browsers with Web Worker, WASM and OffscreenCanvas support.
  - Strict-CSP consumers need `script-src 'wasm-unsafe-eval'` and `worker-src 'self'` (already part of the documented Loupe CSP); covered by a CSP smoke test in CI.

  **Behavioural improvements**

  - Search matches now carry real page indices (previously always 0) and match across formatting-run boundaries; every match reports precise geometry.
  - Scroll-tracked current page now works for DOCX (real per-page rects instead of a single flow).
  - Password-protected documents (Agile Encryption) load via the existing `LoadOptions.password`, decrypted client-side.
  - Thumbnails render via the engine (`renderPageToBitmap`) and now include embedded images and fonts; still opt-in.
  - Internal bookmark links now navigate within the document; external links keep the http/https/mailto allowlist and `link-click` relay, and never auto-navigate.

  **Security model**

  - Zip hygiene (size/ratio/entry-count/path-traversal caps) still runs before any bytes reach the engine; the engine adds its own decompression and decoded-image budgets (`RESOURCE_EXHAUSTED` on violation).
  - XXE-safe XML parsing, memory-safe Rust parsers inside the WASM sandbox, no network egress from document content (tested).

  `docx-preview`, `dompurify` and the iframe asset pipeline are removed; `@silurus/ooxml` is pinned exactly (pre-1.0 — treat minor bumps as breaking in dependency tooling).

## 2.0.0

### Minor Changes

- e9f0b02: DOCX search now returns real per-occurrence matches with geometry (VDX-192).

  `search()` round-trips through the sandboxed iframe: one enumeration produces
  both the match list (zoom-normalised, root-relative bounds per occurrence) and
  the ordinal-tagged highlight spans, so the reported count and the highlights on
  screen always agree — no more "1 of 1" on a document full of matches. The
  adapter now declares and implements the `scrollToRect` capability (scrolling is
  computed inside the iframe against live layout, so it stays correct across
  zoom) and `setActiveSearchMatch`, giving next/previous real stepping with the
  active match visually emphasised. The 2000-match cap and the visible-text rule
  now apply to highlighting as well as counting.

### Patch Changes

- bc7350f: Security dependency bumps: pdfjs-dist 6.1.200 → 6.3.289 in loupe-pdf
  (clears GHSA-wgrm-67xf-hhpq and GHSA-hq66-cqwq-w95j, both fixed in 6.2.108;
  we take the latest 6.x, and the bundled pdf.worker is rebuilt from the same
  version so API and worker stay in lockstep) and dompurify 3.4.11 → 3.4.15 in
  loupe-docx (clears GHSA-c2j3-45gr-mqc4 and GHSA-55q2-fjhq-7xh7).
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

## 0.1.2

### Patch Changes

- 6227707: Load the DOCX iframe render script as an external same-origin `<script src>`
  instead of inlining it into the sandboxed `srcdoc`. An `about:srcdoc` frame
  inherits the host page's CSP, so the inlined script was blocked under a strict
  `script-src 'self'` (no `'unsafe-inline'`), leaving DOCX unable to render. The
  external same-origin script is allowed under `script-src 'self'`, so DOCX now
  renders under the CSP documented in SECURITY.md with no host-CSP change. The
  frame's own `script-src` also drops `'unsafe-inline'` (defense-in-depth).

## 0.1.1

### Patch Changes

- ea92d60: All dependencies are now pinned to exact versions (general supply-chain
  hygiene, and the same class of protection as the pdf.js worker pin: what we
  test and publish against is exactly what consumers install). Peer dependencies
  intentionally remain ranges.
