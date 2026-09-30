# Loupe for Developers

Routes:

- `/` — Loupe homepage: the interactive Word (.docx/.docm) inspector. Open a file or a sample to see the real Loupe viewer with retained comments, tracked changes, findings and timeline. Everything runs in the browser.
- `/try` — legacy alias, redirects to `/`.
- `/playground` — multi-format document workspace with eight real sample formats (PDF, DOCX, TIFF, PNG, JPEG, WebP, GIF and SVG), local file tabs, capability-aware controls and integration excerpts. Its top toolbar includes page jumping, zoom presets, fit controls, rotation, layers/notes/marker shortcuts, fullscreen and original-file download.
- `/developers` — one-package install, copyable JSON prompt for AI agents, integration examples, API excerpt, format support and runtime assets. Public release and source links come from `src/lib/release.ts`.
- `/original` — archived first developer site (noindex), kept unchanged for reference.

## Development

```sh
bun install --frozen-lockfile
bun run dev      # predev copies document runtime assets to public/loupe/
bun run build    # prebuild does the same
```

`scripts/copy-loupe-assets.mjs` copies `docx_parser_bg.wasm` from the installed `@silurus/ooxml` so the served WASM always matches the engine version. It also copies the vendored PDF and TIFF workers, adding the PDF browser compatibility shim to the generated worker.

## Notes for the inspector

- Loupe packages are vendored in `vendor/` under their internal names. The public source and compiled package use the Loupe Use Licence (© Veridox); they are not open source.
- The DOCX engine is browser-only; `vite.config.ts` swaps it for a throwing stub in the server build.
- Inspector colours are scoped to the inspector (`.loupe-try` / `html.loupe-try-active` in `src/styles.css`); the `dark` class is removed when leaving it.
- Samples live in `public/sample-*.docx`.

## Website and GitHub export

Live site: https://tryloupe.lovable.app/ — developer guide at `/developers`, multi-format demo at `/playground`.

Exported from Lovable project `dd78098d-5a29-4079-bf95-8d0246305318`, revision `ba7173315b2d5fbb7225de24c3ae0905b6efa9ac`. Lovable remains authoritative for the website; this folder is a saved copy and does not automatically synchronize. The library lives at the repository root.

The background asset is included under `public/__l5e/assets-v1/` so this export can run independently of Lovable asset hosting.

The developer guide installs `@andreilocota/loupe` 0.1.2 from a public GitHub release in `AndreiLocota/loupe`. Source is public under the Loupe Use Licence. `/downloads/` retains the licence, README, checksums and legacy 0.1.0 archive.

The developer hero includes the user-provided 16-second launch video in `public/media/`, with its audio stream removed. The inline loop pauses offscreen and respects reduced-motion preferences and manual pause.

Commercial and production use need no separate approval. Compiled Loupe code and runtime assets may ship within applications; standalone redistribution remains prohibited. Preserve copyright and third-party notices. See public/downloads/LOUPE-LICENSE.txt.
