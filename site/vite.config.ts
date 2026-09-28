// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

// The DOCX engine (@veridox-ai/loupe-docx -> @silurus/ooxml) is browser-only:
// its module scope evaluates `new URL(..., import.meta.url)` and constructs a
// Worker, which throws in the Worker runtime. /try only imports it dynamically
// from a client effect, so replace it with a throwing stub in the server build
// and keep the real module in the browser bundle.
const STUB_ID = "\0loupe-docx-server-stub";

function stubDocxEngineOnServer(): Plugin {
  const isBrowserOnly = (source: string) =>
    source === "@veridox-ai/loupe-docx" || source.startsWith("@silurus/ooxml");

  return {
    name: "stub-docx-engine-on-server",
    enforce: "pre",
    resolveId(source, _importer, options) {
      const server =
        options?.ssr === true ||
        (this.environment?.name !== undefined && this.environment.name !== "client");
      if (server && isBrowserOnly(source)) return STUB_ID;
      return null;
    },
    load(id) {
      if (id !== STUB_ID) return null;
      return [
        'const unavailable = () => { throw new Error("The DOCX engine only runs in the browser."); };',
        "export const createDocxAdapterFactory = unavailable;",
        "export default {};",
      ].join("\n");
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [stubDocxEngineOnServer()],
  },
});
