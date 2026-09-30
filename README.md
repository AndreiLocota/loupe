# Loupe

A headless document viewer library for **PDF, DOCX, and images**. Rendering happens in the browser; no Loupe server, API key, or account is needed at runtime. Your app provides the toolbar and surrounding interface. TypeScript core, optional React bindings.

[Try Loupe](https://tryloupe.lovable.app/) · [Multi-format playground](https://tryloupe.lovable.app/playground) · [Developer guide](https://tryloupe.lovable.app/developers) · [Package downloads](https://github.com/AndreiLocota/loupe/releases/download/v0.1.3/andreilocota-loupe-0.1.3.tgz)

## From the demo to your app

The browser demo is a Word inspector built with Loupe. Loupe supplies document rendering, page navigation, zoom, text selection and search. The inspector adds its own retained-change findings, comments panel and timeline; those application features are not part of the library API.

Install the complete viewer package in your application:

```sh
npm install https://github.com/AndreiLocota/loupe/releases/download/v0.1.3/andreilocota-loupe-0.1.3.tgz
```

This prebuilt package includes the core, PDF, Word and image adapters, and optional React bindings. No GitHub account, repository clone or Loupe build is needed. Start with the [integration guide](docs/getting-started.md) or the [public package guide](https://tryloupe.lovable.app/downloads/README.md).

```ts
import { ViewerStore } from '@andreilocota/loupe';
import { createDocxAdapterFactory } from '@andreilocota/loupe/docx';

const viewer = new ViewerStore();
viewer.registerFactory(createDocxAdapterFactory());
viewer.setMountElement(document.querySelector('#viewer'));
// In your file input handler, where `file` is a File:
await viewer.loadDocument({ data: file, fileName: file.name }, { initialZoom: 'fit-page' });
```

Give the viewer element a height. The guide includes the file input, error handling and cleanup. Vite automatically emits the required workers and WASM; an optional `npx loupe-assets public/loupe` command supports bundlers needing explicit asset URLs.

## Licence

Free for personal, commercial and production use. No separate approval is required. You may ship Loupe within your applications; standalone redistribution of the library, SDK or package is prohibited. Preserve the licence and copyright notices in permitted copies. See [distribution/LICENSE](distribution/LICENSE) and [LICENSE](LICENSE). Loupe is source-available, not open source.

## Internal packages

The public `@andreilocota/loupe` archive combines these implementation packages; consumers do not need to install them individually.

| Package | Version | Purpose |
|---|---|---|
| `@veridox-ai/loupe-core` | 0.3.1 | ViewerStore, adapter interface, document detection and events |
| `@veridox-ai/loupe-docx` | 3.0.2 | Word rendering, pagination, text selection and search |
| `@veridox-ai/loupe-pdf` | 2.0.1 | PDF rendering, selection, search, layers and annotations |
| `@veridox-ai/loupe-image` | 2.0.0 | JPEG, PNG, GIF, WebP, SVG, TIFF and HEIC |
| `@veridox-ai/loupe-react` | 2.0.0 | React provider, viewer surface and hooks |

The JavaScript API is the interface used by your code, not a hosted HTTP service. The separate DOCX inspector adds its own findings UI; the library provides the document rendering and controls.

## Repository layout

- `packages/` — the five library packages and their tests.
- `examples/` — working React reference viewer.
- `docs/` — integration, architecture, runtime assets and security guidance.
- `corpus/production/` — synthetic documents for testing.
- `site/` — Loupe website, with its own Bun dependencies. It is an independent Lovable export, not part of the npm workspace.

## Development

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run pack:packages
npm run verify:packages
```

For browser checks, run `npx playwright install chromium firefox`, then `npm run test:browser`. Additional security and visual suites are described in [CONTRIBUTING.md](CONTRIBUTING.md). A GitHub Actions template is saved as `docs/ci-workflow.yml`; automation is not active because the current GitHub login lacks permission to add workflows. `npm run dev:packages` watches library source during development.

For the saved website, enter `site/`, then run `bun install --frozen-lockfile` and `bun run dev`. The upload experience lives at `/`, the multi-format playground at `/playground`, the integration guide at `/developers`, and the previous landing page is preserved at `/original`. `/try` remains a compatibility route. It is not automatically synchronized with Lovable.

## Distribution

Maintainers with repository access can run `npm run build` and `npm run pack:viewer` to create the public archive and its integrity manifest. Its content is compiled from all five packages, with one shared core and optional React peers. Source and compiled distribution carry the same use licence. The original `pack:packages` workflow remains available for internal consumers. No package has been published to the public npm registry.
