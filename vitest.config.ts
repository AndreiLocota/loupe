import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Resolve @veridox-ai/loupe-* to package SOURCE (mirroring the tsconfig `paths`) so unit
// tests run against src and don't require a dist build. Adapters now import
// runtime values (createError) from @veridox-ai/loupe-core, so without this alias
// vitest would try to resolve the packages' `main` (./dist/index.js), which
// isn't built in CI's lint/type/test job.
const loupe = (name: string): string =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@veridox-ai/loupe-core': loupe('viewer-core'),
      '@veridox-ai/loupe-pdf': loupe('viewer-pdf'),
      '@veridox-ai/loupe-docx': loupe('viewer-docx'),
      '@veridox-ai/loupe-image': loupe('viewer-image'),
      '@veridox-ai/loupe-react': loupe('viewer-react'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.{ts,tsx}'],
    exclude: [
      '**/*.browser.test.ts',
      '**/*.visual.test.ts',
      '**/*.security.test.ts',
    ],
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'json-summary'],
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        'packages/*/src/**/*.d.ts',
        // Runs in a Web Worker context, not reachable by jsdom unit tests —
        // exercised by the browser/security Playwright suites instead.
        'packages/viewer-image/src/workers/**',
      ],
      // Ratchet floor: set just below current measured coverage (lines/statements
      // ~78%, functions ~78%, branches ~73%; the jump from ~33% came from the
      // 3.0 removal of the huge uncovered DOCX iframe script) so regressions
      // fail CI. Raise these — and add per-package thresholds — as more suites
      // land (react bindings, real-adapter browser tests, capability coverage).
      thresholds: {
        lines: 72,
        functions: 72,
        branches: 68,
        statements: 72,
      },
    },
  },
});
