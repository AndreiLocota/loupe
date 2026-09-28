<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This folder is an exported copy of a [Lovable](https://lovable.dev) project; this repository is not connected to automatic Lovable synchronization. Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> The original project remains in Lovable. Update this export deliberately; pushes here do not update the Lovable editor.
<!-- LOVABLE:END -->

## Architecture rules
- `/try` DOCX inspector lives in `src/components/docx` + `src/lib/docx`; Loupe packages are vendored in `vendor/` — why: private packages, no registry access.
- DOCX engine (`@veridox-ai/loupe-docx`, `@silurus/ooxml`) is stubbed on the server in `vite.config.ts` and only dynamically imported client-side — why: it constructs a Worker at module scope and crashes SSR.
- Inspector palette is scoped via `.loupe-try` / `html.loupe-try-active` — why: keep `/` visually unchanged.
