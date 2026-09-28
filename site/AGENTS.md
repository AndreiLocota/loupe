<!-- LOVABLE:BEGIN -->
> This is an exported copy of the Lovable website. This repository is not
> connected to automatic Lovable synchronization. Lovable remains authoritative
> for website edits; update this export deliberately. Preserve published Git history.
<!-- LOVABLE:END -->

## Architecture rules
- `/` DOCX inspector lives in `src/components/docx` + `src/lib/docx`; Loupe packages are vendored in `vendor/` — why: private packages, no registry access.
- DOCX engine (`@veridox-ai/loupe-docx`, `@silurus/ooxml`) is stubbed on the server in `vite.config.ts` and only dynamically imported client-side — why: it constructs a Worker at module scope and crashes SSR.
- Inspector palette is scoped via `.loupe-try` / `html.loupe-try-active` — why: keep `/developers` and `/original` visually unchanged.
- Library repo/release/docs links and public-access flag live only in `src/lib/release.ts` — why: one follow-up edit enables public access and licence terms.
