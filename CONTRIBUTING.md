# Contributing

Internal contributor guide for the Loupe Document Viewer — a headless,
client-side document viewer (PDF, DOCX, images) with a framework-agnostic core
and React bindings. **This is proprietary software** (see [LICENSE](LICENSE)); it
is not open to public contribution. See [AGENTS.md](AGENTS.md) for conventions
and architecture and [docs/concepts.md](docs/concepts.md) for the design
rationale.

## Prerequisites

- Node.js 24 LTS
- npm (the repo uses npm workspaces)

## Setup

```bash
npm install
npm run build      # builds all packages + bundled worker/iframe assets
```

## Development loop

Always run these after making changes — CI runs the same:

```bash
npm run lint       # ESLint (strict TS rules; the tree is warning-clean)
npm run typecheck  # tsc --noEmit (strict + exactOptionalPropertyTypes)
npm test           # unit tests (Vitest + jsdom)
```

Slower suites (require a build first):

```bash
npm run build
npm run test:browser    # Playwright (Chromium + Firefox)
npm run test:security   # CSP / security invariants
npm run test:visual     # visual-regression snapshots
```

## Ground rules

- **ES modules only** (`"type": "module"`, `.js` extensions on relative
  imports). Named exports only — no default exports.
- **No `any`** without written justification; the tree lints clean with zero
  warnings — keep it that way. `strict` + `exactOptionalPropertyTypes` are on.
- **Every format is a `DocumentAdapter`** behind an `AdapterFactory`; the shell
  talks to `ViewerStore` / the React hooks, never to an engine directly.
- **Untrusted input:** every document is hostile until proven otherwise. Don't
  weaken the DOCX iframe sandbox/CSP, the zip-hygiene caps, or SVG handling
  without a security review. See [docs/SECURITY.md](docs/SECURITY.md).
- Prefer capability-driven behavior: gate UI/features on `AdapterCapabilities`
  rather than format sniffing in the shell.

## Adding a document format

See the "Adding a new adapter" section in [AGENTS.md](AGENTS.md). In short:
create `packages/viewer-{format}/`, implement `DocumentAdapter` + export an
`AdapterFactory`, add a magic-byte signature to
`packages/viewer-core/src/detection/formatDetection.ts`, and add tests.

## Changesets & releases

Versioning uses [Changesets](https://github.com/changesets/changesets). Add a
changeset describing user-facing changes:

```bash
npm run changeset
```

Maintainers run `npm run version` when changing package versions. Build and run `npm run pack:packages` to produce distributable archives. This repository does not automatically publish to the upstream private registry. The public source and compiled viewer use the terms in LICENSE: commercial and production use are allowed without separate approval; application distribution is allowed, but standalone redistribution is prohibited. Use `npm run pack:viewer` for the all-in-one public archive.

## Reporting security issues

Do **not** open a public issue for vulnerabilities. Follow the process in
[SECURITY.md](SECURITY.md).
