# ADR-001: PDF Engine Selection

**Status:** Accepted
**Date:** 2026-07-06
**Supersedes:** (none)

## Context

We need a PDF rendering engine for `@veridox-ai/loupe-pdf`. Two candidates:

1. **PDF.js** — Mozilla, MIT, v6.x (`pdfjs-dist` ^6.1.200), ~15 years of maintenance, 1.7M weekly npm downloads
2. **EmbedPDF** — MIT, v2.14.4, PDFium-based (WASM), comprehensive plugin architecture

Both are MIT-licensed and available on npm.

## Evaluation

Both engines were wired into a side-by-side comparison harness and tested against the corpus PDFs. (The harness itself was a throwaway and is not retained in the repository.)

### Scoring

| Criterion | Weight | PDF.js | EmbedPDF | Notes |
|---|---|---|---|---|
| Fidelity on corpus | 25% | High | High | PDF.js uses HTML5 canvas; EmbedPDF uses PDFium (same engine as Chrome). Both render accurately. |
| Security posture | 20% | High | High | PDF.js: `enableScripting: false` by default. EmbedPDF: PDFium never executes JS in render path. Both ignore JS actions. |
| Headless API quality | 20% | Medium | Low* | PDF.js: well-documented `getDocument()`/`getPage()`/`render()` API. EmbedPDF: complex plugin architecture requiring React; raw PDFium C API needs wrapper. |
| Maintenance health | 15% | High | Medium | PDF.js: 15yr track record, Mozilla-backed, 1.7M weekly downloads. EmbedPDF: single maintainer (`bobsingor`), smaller community but active releases (Jun 2026). |
| Bundle size | 10% | Medium | Low | PDF.js: ~380KB (core + worker, minified, before compression). EmbedPDF: ~2.2MB (PDFium WASM) + ~200KB JS. WASM is a one-time cost, cached. |
| Text layer / a11y | 10% | High | Medium | PDF.js: built-in text extraction with per-character bounds for accessibility. EmbedPDF: PDFium has `_FPDFText_*` APIs but no built-in text layer — must be built. |

> *EmbedPDF's "Headless API" rating applies to raw PDFium. EmbedPDF's React viewer (`@embedpdf/react-pdf-viewer`) provides a higher-level API but it's React-coupled and opinionated.

### Bundle Size Details

> **Note:** the figures below were measured against PDF.js v4.x during the
> original bake-off and are **approximate**. The shipped engine is now
> `pdfjs-dist` ^6.1.200; the v6 core/worker sizes are in the same order of
> magnitude but have not been re-measured. Treat these as indicative, not exact.

| Engine | JS (min) | Worker/WASM | Total (uncompressed) |
|---|---|---|---|
| PDF.js (v4-era) | ~113KB | ~267KB (worker) | ~380KB |
| EmbedPDF | ~203KB | ~2,024KB (PDFium WASM) | ~2,227KB |

Both see significant reduction with gzip/brotli compression.

## Decision

**Use PDF.js as the primary engine for Phase 2.**

Rationale:
1. **Headless API** — PDF.js's imperative `getDocument()`/`render()` API maps cleanly to our `DocumentAdapter` interface. EmbedPDF's raw PDFium requires building a text layer, search, and selection from scratch.
2. **Text layer** — Built-in, per-character text extraction with bounds. Critical for accessibility and search UI. PDFium's `_FPDFText_*` provides this but requires manual implementation.
3. **Bundle size** — PDF.js is ~380KB vs EmbedPDF's ~2.2MB (v4-era, approximate). The difference of ~1.8MB matters for first-load experience, especially on mobile.
4. **Maintenance** — Mozilla-backed, large community, battle-tested on Firefox's built-in viewer.
5. **Search built-in** — `getTextContent()` returns structured text items; PDFium requires `_FPDFText_FindStart`/`_FPDFText_FindNext` C API.

## EmbedPDF as Fallback

EmbedPDF remains a viable fallback path:
- The adapter seam (§2.1 of build plan) isolates engine choice. Swapping engines is a single adapter replacement — consumers are unaware.
- PDFium's rendering fidelity may be superior for CJK/scanned documents (Chrome uses PDFium internally).
- The `@embedpdf/engines` worker architecture aligns with our worker-per-document strategy.
- If PDF.js fidelity on our real corpus falls below thresholds, we pivot to EmbedPDF in a point release.

## Consequences

- Phase 2 (PDF adapter) uses PDF.js: `pdfjs-dist` as the rendering engine behind `@veridox-ai/loupe-pdf`.
- EmbedPDF's WASM and JS are NOT bundled — lazy loading guarantees hold.
- Adapter interface is designed so EmbedPDF can be dropped in later without consumer changes.
- Visual regression baselines for PDF rendering must be re-recorded when the engine changes.

## References

- [PDF.js API docs](https://mozilla.github.io/pdf.js/api/)
- [EmbedPDF on npm](https://www.npmjs.com/package/@embedpdf/pdfium)
- [Concepts — Adapter interface](concepts.md) — Adapter interface definition
- [`DocumentAdapter.ts`](../packages/viewer-core/src/adapters/DocumentAdapter.ts) — the adapter contract in code
