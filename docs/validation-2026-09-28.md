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

## Website journey update

The upload-first homepage and integration guide were subsequently published to https://tryloupe.lovable.app/. The previous developer homepage is preserved at `/original` with `noindex`; `/try` redirects to `/`. Exported Lovable revision: `9f4043801598b80220fc3af551caa3b6e71085c4`.

- Website frozen-lockfile Bun install, TypeScript check and production build passed.
- Browser verification at 1440×900 and 390×844: homepage fits, both Word samples render real document canvases, developer links work from landing/viewer, return link works, developer page has no horizontal overflow, and demo dark mode is cleaned up.
- Archive deep link and noindex metadata verified; `/try` redirects correctly.
- No browser page errors observed.
- Library lint and TypeScript rechecked; zero errors, same 23 upstream lint warnings. Library runtime code is unchanged, so its previous unit/integration results above still describe that code.
- GitHub metadata and README now link back to the canonical demo and guide. Repository and package archives remain private pending the owner's reuse-terms decision; the website explicitly labels restricted links.
