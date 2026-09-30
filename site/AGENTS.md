<!-- LOVABLE:BEGIN -->
> This is an exported copy of the Lovable website. This repository is not
> connected to automatic Lovable synchronization. Lovable remains authoritative
> for website edits; update this export deliberately. Preserve published Git history.
<!-- LOVABLE:END -->

## Architecture rules
- `/` DOCX inspector lives in `src/components/docx` + `src/lib/docx`; Loupe packages are vendored in `vendor/` — why: internal package names, not on a public registry.
- DOCX engine (`@veridox-ai/loupe-docx`, `@silurus/ooxml`) is stubbed on the server in `vite.config.ts` and only dynamically imported client-side — why: it constructs a Worker at module scope and crashes SSR.
- Inspector palette is scoped via `.loupe-try` / `html.loupe-try-active` — why: keep `/developers` and `/original` visually unchanged.
- Public package name/URL/checksum/licence and source-repo links live in `src/lib/release.ts`. Source and compiled package are public under the Loupe Use Licence. Consumer snippets use @andreilocota/loupe; actual vendor imports retain internal names.

Commercial and production use need no separate approval. Compiled Loupe code and runtime assets may ship within applications; standalone redistribution remains prohibited. Preserve copyright and third-party notices. See public/downloads/LOUPE-LICENSE.txt.
