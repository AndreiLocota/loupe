export const DEMO_URL = "https://veridocx.lovable.app";

export type SectionId =
  | "overview"
  | "capabilities"
  | "architecture"
  | "api-preview"
  | "runtime-assets"
  | "availability";

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "capabilities", label: "Capabilities" },
  { id: "architecture", label: "Architecture" },
  { id: "api-preview", label: "API preview" },
  { id: "runtime-assets", label: "Runtime assets" },
  { id: "availability", label: "Availability" },
];

export const PACKAGES = [
  { name: "@veridox-ai/loupe-core", note: "Framework-agnostic viewer core" },
  { name: "@veridox-ai/loupe-react", note: "Optional React bindings (React >= 18)" },
  { name: "@veridox-ai/loupe-pdf", note: "PDF adapter" },
  { name: "@veridox-ai/loupe-docx", note: "DOCX adapter" },
  { name: "@veridox-ai/loupe-image", note: "Image adapter" },
];

export const CHIPS = [
  "Headless core",
  "TypeScript",
  "Client-side rendering",
  "Optional React bindings",
  "You own the toolbar",
  "Pre-1.0",
];

export const API_SNIPPET = `import { ViewerStore } from '@veridox-ai/loupe-core';
import { createDocxAdapterFactory } from '@veridox-ai/loupe-docx';

const store = new ViewerStore();

store.registerFactory(
  createDocxAdapterFactory({
    thumbnails: true,
    wasmUrl: '/assets/docx_parser_bg.wasm',
  }),
);`;

type Support = "yes" | "no" | "optional" | "partial";

export const MATRIX_COLUMNS = [
  "Render",
  "Page navigation",
  "Zoom",
  "Text selection",
  "Search + match highlight",
  "Thumbnails",
  "Rotation",
  "Layers",
  "Annotation inspection",
] as const;

export const MATRIX_ROWS: {
  format: string;
  detail: string;
  values: (Support | string)[];
}[] = [
  {
    format: "PDF",
    detail: "@veridox-ai/loupe-pdf",
    values: ["yes", "yes", "yes", "yes", "yes", "yes", "yes", "yes", "yes"],
  },
  {
    format: "DOCX",
    detail: "@veridox-ai/loupe-docx",
    values: ["yes", "yes", "yes", "yes", "yes", "optional", "no", "no", "no"],
  },
  {
    format: "Images",
    detail: "JPEG, PNG, GIF, WebP, SVG, TIFF, HEIC",
    values: [
      "yes",
      "multi-page TIFF",
      "yes",
      "no",
      "no",
      "multi-page TIFF",
      "multi-page TIFF",
      "no",
      "no",
    ],
  },
];

export const API_CARDS: {
  symbol: string;
  kind: string;
  description: string;
  members?: string[];
}[] = [
  {
    symbol: "ViewerStore",
    kind: "core class",
    description:
      "The headless viewer state container. Format adapters are registered on it with registerFactory().",
  },
  {
    symbol: "ViewerProvider",
    kind: "react component",
    description: "Provides a ViewerStore to the React tree.",
  },
  {
    symbol: "ViewerSurface",
    kind: "react component",
    description: "Renders the document surface. All surrounding chrome is yours to build.",
  },
  {
    symbol: "useViewer(store)",
    kind: "react hook",
    description: "Returns viewer state plus the document and view actions.",
    members: [
      "state",
      "loadDocument",
      "closeDocument",
      "goToPage",
      "setZoom",
      "search",
      "clearSearch",
      "nextSearchMatch",
      "previousSearchMatch",
    ],
  },
  {
    symbol: "usePageNavigation(viewer)",
    kind: "react hook",
    description: "Page-level navigation helpers derived from the viewer.",
    members: ["currentPage", "pageCount", "goToPage", "goToNext", "goToPrev"],
  },
  {
    symbol: "useZoom(viewer)",
    kind: "react hook",
    description: "Exposes setZoom, with fit-width and fit-page fit modes.",
    members: ["setZoom", "fit-width", "fit-page"],
  },
  {
    symbol: "useCapabilities(store?)",
    kind: "react hook",
    description:
      "Lets the UI gate format-specific features, so controls only appear where the adapter supports them.",
  },
];

export const RUNTIME_ASSETS = [
  {
    title: "DOCX",
    body: "A WebAssembly module plus a worker. Point the adapter at the WASM URL you serve, for example /assets/docx_parser_bg.wasm.",
  },
  {
    title: "PDF",
    body: "A dedicated worker for parsing and rendering off the main thread.",
  },
  {
    title: "TIFF",
    body: "A worker used for decoding, including multi-page TIFF documents.",
  },
  {
    title: "HEIC",
    body: "A dynamically loaded dependency, pulled in only when a HEIC file is opened.",
  },
];

