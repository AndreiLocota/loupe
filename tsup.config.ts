import { defineConfig, type Options } from 'tsup';

// Single canonical build: each package is emitted to its OWN dist/ — the exact
// path its package.json `main`/`exports` point at and that external consumers
// resolve. (The in-repo example bundles from src/ via the root tsconfig
// `@veridox-ai/*` path mapping, so it does NOT exercise this dist output — CI
// builds dist and the browser fixture imports it directly.) Runtime deps and
// cross-package (@veridox-ai/*) imports stay external so per-package output
// stays small and dedupes at install time.
const external = [
  'pdfjs-dist',
  /^@silurus\//,
  'jszip',
  'utif',
  'heic-to/csp',
  'react',
  'react-dom',
  'react/jsx-runtime',
  /^@veridox-ai\//,
];

const pkg = (name: string): Options => ({
  name,
  entry: { index: `packages/${name}/src/index.ts` },
  outDir: `packages/${name}/dist`,
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  external,
});

export default defineConfig([
  pkg('viewer-core'),
  pkg('viewer-pdf'),
  pkg('viewer-docx'),
  pkg('viewer-image'),
  pkg('viewer-react'),
]);
