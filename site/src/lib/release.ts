/**
 * Single source of truth for Loupe library release links and access state.
 * Flip PUBLIC_LIBRARY_AVAILABLE (and set LICENSE_SUMMARY) once the owner makes
 * the repository public and approves reuse terms.
 */
export const PUBLIC_LIBRARY_AVAILABLE = false;

/** Short, owner-approved licence summary. null = link to LICENSE only. */
export const LICENSE_SUMMARY: string | null = null;

export const REPO_URL = "https://github.com/AndreiLocota/loupe";
export const REPO_CLONE_URL = `${REPO_URL}.git`;
export const RELEASE_TAG = "library-preview-2026-09-28";
export const RELEASE_URL = `${REPO_URL}/releases/tag/${RELEASE_TAG}`;
export const DOCS_URL = `${REPO_URL}/blob/main/docs/getting-started.md`;
export const EXAMPLE_URL = `${REPO_URL}/blob/main/examples/viewer-app.tsx`;
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;

export const NODE_VERSION = "Node.js 24 LTS";
export const EXAMPLES_URL = "http://127.0.0.1:5173/examples/";

export const PACKAGE_ARCHIVES = [
  "veridox-ai-loupe-core-0.3.1.tgz",
  "veridox-ai-loupe-docx-3.0.2.tgz",
  "veridox-ai-loupe-react-2.0.0.tgz",
] as const;

export const QUICKSTART = `git clone ${REPO_CLONE_URL}
cd loupe
npm ci
npm run build
npm run dev`;

export const PACK_COMMAND = "npm run pack:packages";

export const INSTALL_COMMAND = `npm install ${PACKAGE_ARCHIVES.map((a) => `../loupe/artifacts/${a}`).join(" ")}`;

/** Shown next to GitHub/release links while the repository is private. */
export const ACCESS_NOTE = PUBLIC_LIBRARY_AVAILABLE
  ? null
  : "The repository is currently private while its reuse licence is decided. These commands and links work only for accounts with repository access.";

export const LINK_ACCESS_SUFFIX = PUBLIC_LIBRARY_AVAILABLE ? "" : " (requires repository access)";
