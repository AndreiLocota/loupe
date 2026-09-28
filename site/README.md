# Loupe for Developers

Routes:

- `/` — Loupe homepage: the interactive Word (.docx/.docm) inspector. Open a file or a sample to see the real Loupe viewer with retained comments, tracked changes, findings and timeline. Everything runs in the browser.
- `/try` — legacy alias, redirects to `/`.
- `/developers` — integration-first page (quick start, install, API excerpt, format support, runtime assets). Links and access state come from `src/lib/release.ts`; flip `PUBLIC_LIBRARY_AVAILABLE` (and `LICENSE_SUMMARY`) when the repository goes public.
- `/original` — archived first developer site (noindex), kept unchanged for reference.

## Development

```sh
bun install --frozen-lockfile
bun run dev      # predev copies the DOCX engine WASM to public/loupe/
bun run build    # prebuild does the same
```

`scripts/copy-loupe-assets.mjs` copies `docx_parser_bg.wasm` from the installed `@silurus/ooxml` so the served WASM always matches the engine version.

## Notes for the inspector

- Loupe packages are vendored in `vendor/` (private, `UNLICENSED`, © Veridox — see `vendor/README.md`). They are not open source or publicly available.
- The DOCX engine is browser-only; `vite.config.ts` swaps it for a throwing stub in the server build.
- Inspector colours are scoped to the inspector (`.loupe-try` / `html.loupe-try-active` in `src/styles.css`); the `dark` class is removed when leaving it.
- Samples live in `public/sample-*.docx`.

## Website and GitHub export

Live site: https://tryloupe.lovable.app/ — developer guide at `/developers`.

Exported from Lovable project `dd78098d-5a29-4079-bf95-8d0246305318`, revision `9f4043801598b80220fc3af551caa3b6e71085c4`. Lovable remains authoritative for the website; this folder is a saved copy and does not automatically synchronize. The library lives at the repository root.

The background asset is included under `public/__l5e/assets-v1/` so this export can run independently of Lovable asset hosting.
