# Library import validation — 28 September 2026

- `npm ci`: passes with public-registry dependencies; no private npm token used.
- Lint: zero errors, 23 existing upstream warnings. Local run sets `ESLINT_USE_FLAT_CONFIG=false` to prevent the surrounding portfolio's ESLint flat config being inherited. A standalone checkout uses this repository's `.eslintrc.json`.
- `npm run typecheck`: passes.
- `npm test`: 205 tests pass across 13 files.
- `npm run build`: all five packages, declarations, workers and standalone example build.
- `npm run pack:packages`: five archives include built entry points, types and licenses.
- `npm run verify:packages`: all five archives install in an isolated temporary consumer; TypeScript imports resolve, Core runs, PDF/TIFF workers and DOCX WASM are present.
- Existing browser integration suite: 20 tests pass in installed Chrome, covering real PDF and DOCX rendering, page navigation, search, zoom, selection and cleanup. Firefox, CSP and visual suites are included in the saved CI template but were not run locally for this import.
- Reference example manually checked with browser automation for DOCX, PDF and TIFF loading, with no page errors. React is bundled locally instead of fetched from a CDN.
- `npm audit --omit=dev`: zero reported production dependency vulnerabilities at validation time. Existing dev-tool advisories are not addressed in this packaging change.

Library source and tests match upstream revision in `provenance.md`. The saved website was moved to `site/` without changing its source. No public npm publication, license replacement or website deployment was performed.
