# @veridox-ai/loupe-react

React bindings for the [Loupe](https://github.com/veridox-ai/tools.loupe) headless
document viewer: `ViewerProvider`, `ViewerSurface`, `ViewerContext` /
`useViewerStore`, plus 11 hooks (`useViewer`, `useStatus`, `useCapabilities`,
`useLoadDocument`, `usePageNavigation`, `useZoom`, `useSearch`, `useThumbnail`,
`useLayers`, `useAnnotations`, `useRotation`).

```bash
npm install @veridox-ai/loupe-core @veridox-ai/loupe-react
```

Requires React `>= 18` (`react` and `react-dom` are peer dependencies). Pair with
a format adapter (`@veridox-ai/loupe-pdf`, `-docx`, `-image`).

- [Getting Started](https://github.com/veridox-ai/tools.loupe/blob/main/docs/getting-started.md) — hook signatures and a full example
- [Security](https://github.com/veridox-ai/tools.loupe/blob/main/SECURITY.md)

Proprietary — distributed via Veridox's private registry. See
[LICENSE](https://github.com/veridox-ai/tools.loupe/blob/main/LICENSE).
