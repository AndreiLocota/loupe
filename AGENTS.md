# AGENTS.md — AI Agent Instructions

## Project Overview

This is the **Loupe Document Viewer** monorepo. It builds a headless, client-side document viewer library for PDF, DOCX, and images. The core is framework-agnostic TypeScript; React bindings are layered on top.

Architecture & design rationale: [`docs/concepts.md`](docs/concepts.md) (plus the Repository Layout and conventions below).

## Repository Layout

```
├── packages/
│   ├── viewer-core/       # Adapter interface, ViewerStore state machine, format detection, errors, events, cancellation
│   ├── viewer-pdf/        # PDF adapter (PDF.js): text layer, search, thumbnails, rotation, layers (OCG), annotations
│   ├── viewer-docx/       # DOCX adapter: @silurus/ooxml (Rust→WASM, canvas, worker parsing), zip hygiene, search geometry, opt-in thumbnails
│   ├── viewer-image/      # Image adapter: native, SVG (sanitized), multi-page TIFF (worker), HEIC; zoom/pan, rotation
│   └── viewer-react/      # React bindings: ViewerProvider, ViewerSurface, 11 hooks
├── test/fixtures/         # Browser test harness HTML
├── corpus/                # Test document corpus (production + malicious)
├── docs/                  # Documentation, ADRs
├── examples/              # Repo-only reference viewer (not published)
└── docs/ci-workflow.yml   # CI pipeline template (not active)
```

All five packages are implemented (not stubs).

## Conventions

### TypeScript
- **Strict mode** with `exactOptionalPropertyTypes: true`
- ES modules only (`"type": "module"`, `.js` extensions in imports)
- No `any` without justification
- Prefer `interface` over `type` for public APIs
- Error codes use `UPPER_SNAKE_CASE`
- Private class fields are `private` (not `#`)

### Patterns
- **Adapter pattern**: every document format is a `DocumentAdapter` implementation behind `AdapterFactory`
- **Event-driven state**: `ViewerStore` is the single source of truth; subscribers get `ViewerEvent` emissions
- **Capabilities-driven UI**: the shell reads `adapter.capabilities` and degrades (hide search for images, etc.)
- **Lazy loading**: adapters are imported dynamically; opening an image must not download PDF WASM
- **Cancellation**: `CancellationTokenSource` wraps `AbortController` for cooperative cancellation

### Testing
- **Unit tests**: Vitest + jsdom, files named `*.test.ts`, exclude `*.browser.test.ts`, `*.visual.test.ts`, `*.security.test.ts`
- **Browser tests**: Playwright, files named `*.browser.test.ts`, fixture at `test/fixtures/viewer-test.html`
- **Visual regression**: Playwright, files named `*.visual.test.ts`, snapshots in `*-snapshots/` directories
- **Security tests**: Playwright + CSP headers, files named `*.security.test.ts`

### Naming
- Files: `camelCase` for modules, `PascalCase` for classes/interfaces
- Packages: `@veridox-ai/loupe-{core,pdf,docx,image,react}`
- Exports: named exports only (no default exports)

## Commands (in order of importance)

```bash
npm run lint          # Always run first after changes
npm run typecheck     # Always run second after changes
npm test              # Unit tests (Vitest, fast)
npm run test:browser  # Browser integration tests (slower)
npm run test:security # Security invariant tests
npm run test:visual   # Visual regression tests
npm run ci            # Full pipeline
npm run build         # Build all packages (needed before browser tests)
```

## Adding a new adapter

1. Create `packages/viewer-{format}/` with `package.json`, `tsconfig.json`, `src/index.ts`
2. Implement `DocumentAdapter` and export an `AdapterFactory`
3. Register the factory via `store.registerFactory(factory)`
4. Add format signature to `packages/viewer-core/src/detection/formatDetection.ts`
5. Add unit tests under `packages/viewer-{format}/test/`
6. Add browser/visual/security tests as appropriate
7. Update the root `tsup.config.ts` entry point if needed

## Key files to read first

| File | Why |
|---|---|
| `docs/concepts.md` | Architecture, data flow & security rationale |
| `packages/viewer-core/src/adapters/DocumentAdapter.ts` | The library's true public API |
| `packages/viewer-core/src/state/ViewerStore.ts` | State machine implementation |
| `packages/viewer-core/src/detection/formatDetection.ts` | Magic-byte format detection |
| `packages/viewer-core/src/errors/ViewerError.ts` | Error taxonomy |
| `packages/viewer-core/src/cancellation/CancellationToken.ts` | Cancellation pattern |
| `test/fixtures/viewer-test.html` | Browser test harness (loads the built library) |

## CI pipeline template (GitHub Actions)

```
push/PR → lint → typecheck → unit tests → browser tests → security tests → visual regression
```

The workflow is saved as `docs/ci-workflow.yml`; it must be activated by a maintainer with workflow permission before it runs automatically.

- Visual regression uploads diff artifacts on failure
- Security tests run under a strict CSP
- Browser tests run on Chromium + Firefox

## Repository ownership

This library is maintained through GitHub. `site/` is an independent export of the Lovable landing-page project and is not an npm workspace. Keep its Bun dependencies separate. Preserve published Git history. Do not enable the upstream private-registry release workflow here. Package distribution is through local archives until public reuse terms are selected.
