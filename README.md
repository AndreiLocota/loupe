# Loupe

A headless document viewer library for **PDF, DOCX, and images**. Rendering happens in the browser; no Loupe server, API key, or account is needed at runtime. Your app provides the toolbar and surrounding interface. TypeScript core, optional React bindings.

[Try Loupe](https://tryloupe.lovable.app/) · [Developer guide](https://tryloupe.lovable.app/developers) · [Package downloads](https://github.com/AndreiLocota/loupe/releases/tag/library-preview-2026-09-28)

## From the demo to your app

The browser demo is a Word inspector built with Loupe. Loupe supplies document rendering, page navigation, zoom, text selection and search. The inspector adds its own retained-change findings, comments panel and timeline; those application features are not part of the library API.

To try the library itself, run the reference viewer below. It opens PDF, DOCX and images. To embed it in your product, install Core plus the format adapters you need, then use the [integration guide](docs/getting-started.md) and [working React example](examples/viewer-app.tsx). The API is JavaScript/TypeScript running in your browser, not a hosted HTTP service.

## Try the library

Use Node.js 24 LTS and npm. With access to this repository:

```sh
git clone https://github.com/AndreiLocota/loupe.git
cd loupe
npm ci
npm run build
npm run dev
```

Open **http://127.0.0.1:5173/examples/** and choose a PDF, DOCX, or image. Synthetic sample documents are in `corpus/production/`. The example includes page navigation, zoom, search, thumbnails and format-specific controls. Its JavaScript, workers and DOCX WASM are served locally; it does not require a CDN or private package-registry token.

## Use Loupe in your own app

Build and create installable archives from this checkout:

```sh
npm run build
npm run pack:packages
```

The prebuilt archives are also attached to the [library preview release](https://github.com/AndreiLocota/loupe/releases/tag/library-preview-2026-09-28) for people with repository access.

Then, from your application's folder, install **Core plus the adapters you use**, and React bindings if needed. Replace `../loupe` with the path to this checkout:

```sh
npm install ../loupe/artifacts/veridox-ai-loupe-core-0.3.1.tgz ../loupe/artifacts/veridox-ai-loupe-docx-3.0.2.tgz ../loupe/artifacts/veridox-ai-loupe-react-2.0.0.tgz
```

These archives install without Veridox's private registry. Install Core in the same command so npm can satisfy the other packages' Core peer dependency. Do not use `npm install AndreiLocota/loupe` — the repository is a workspace containing five packages, not a single package.

See [Getting Started](docs/getting-started.md) for a React integration and worker/WASM asset setup. `npm run pack:packages` writes all five archives plus their integrity hashes to `artifacts/`.

## Packages

| Package | Version | Purpose |
|---|---|---|
| `@veridox-ai/loupe-core` | 0.3.1 | ViewerStore, adapter interface, document detection and events |
| `@veridox-ai/loupe-docx` | 3.0.2 | Word rendering, pagination, text selection and search |
| `@veridox-ai/loupe-pdf` | 2.0.0 | PDF rendering, selection, search, layers and annotations |
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

For the saved website, enter `site/`, then run `bun install --frozen-lockfile` and `bun run dev`. The upload experience lives at `/`, the integration guide at `/developers`, and the previous landing page is preserved at `/original`. `/try` remains a compatibility route. It is not automatically synchronized with Lovable.

## License and distribution status

The repository and package archives currently retain the upstream **proprietary Veridox license**. This is a private integration preview, not an open-source release. No packages have been published to public npm. Public reuse terms must be selected before the public launch; see [LICENSE](LICENSE). The upstream automated private-registry publishing workflow is intentionally absent here.
