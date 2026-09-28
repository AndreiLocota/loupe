# Bundled Loupe

Vendored for the Veridox DocX Viewer. Private Veridox code; preserve original package license and attribution (UNLICENSED, © Veridox).
Upstream: https://github.com/veridox-ai/tools.loupe
Pinned commit: 6edcf2ceeda0be7991708bc75f5cdbaf7f087628
Versions: core 0.3.1, DOCX 3.0.2.
No local patches: both packages are the unmodified upstream `tsup` ESM + declaration output for that commit. The previous per-page iframe viewport-geometry patch is gone — native viewport geometry (real per-page rects, `scrollToRect`) is upstream now.
Only the package manifests were normalised: `main`/`types`/`exports`/`files` point at `lib/` (upstream publishes from `dist/`), and publish-only fields were dropped.

DOCX 3.x renders to canvas through `@silurus/ooxml` 0.86.0 (WASM parser + worker). There is no iframe and no `docx-preview`/`dompurify` dependency any more; `iframeScriptUrl` is a deprecated no-op.
The predev/prebuild script `scripts/copy-loupe-assets.mjs` copies `docx_parser_bg.wasm` from the installed `@silurus/ooxml` to `public/loupe/docx_parser_bg.wasm`, and the viewer passes that stable same-origin URL as `wasmUrl`. Do not remove that asset or replace Loupe with a substitute renderer.

Runtime artifacts and type declarations are checked in so installing this project never needs the sibling tools.loupe checkout or private registry credentials. Public transitive dependencies (`@silurus/ooxml`, `jszip`) retain their package declarations.
Updates: build and test an explicit upstream commit, replace both package folders together, record the commit and any local patches here, update the lockfile and repeat clean-install/browser verification.
