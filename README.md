# Loupe for Developers

Two pages:

- `/` — the developer landing site (Overview, Capabilities, API preview…).
- `/try` — a working Loupe DOCX inspector. Open a `.docx`/`.docm` (or one of two samples) to see the real Loupe viewer with pagination, search, zoom, retained comments and tracked changes, metadata and a findings report. Everything runs in the browser; nothing is uploaded.

## Development

```sh
bun install --frozen-lockfile
bun run dev      # predev copies the DOCX engine WASM to public/loupe/
bun run build    # prebuild does the same
```

`scripts/copy-loupe-assets.mjs` copies `docx_parser_bg.wasm` from the installed `@silurus/ooxml` so the served WASM always matches the engine version.

## Notes for /try

- Loupe packages are vendored in `vendor/` (private, `UNLICENSED`, © Veridox — see `vendor/README.md`). They are not open source or publicly available.
- The DOCX engine is browser-only; `vite.config.ts` swaps it for a throwing stub in the server build.
- Inspector colours are scoped to `/try` (`.loupe-try` / `html.loupe-try-active` in `src/styles.css`); the `dark` class is removed when leaving `/try`.
- Samples live in `public/sample-*.docx`.

## GitHub copy

This private repository is an export of Lovable project `dd78098d-5a29-4079-bf95-8d0246305318`, revision `5ee384132ca345cc206929a8a01d7d9b590a2cfc` (28 September 2026). The first commit preserves the original developer landing page; the next adds `/try`.

This copy is not yet connected to automatic Lovable/GitHub synchronization. Lovable remains the editing authority. Connect the project through Lovable's GitHub settings before relying on automatic updates.

The original background image is included under `public/__l5e/assets-v1/` at the path used by the Lovable asset manifest, so this export also works independently of Lovable asset hosting. The frontend's original internal licensing notices are retained; this repository is not a public library release.
