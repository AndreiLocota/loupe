/**
 * Single source of truth for Loupe release links and access state.
 * The compiled package download is public; the source repository is private.
 */

/** Public prebuilt package download (no login needed). */
export const PUBLIC_PACKAGE_AVAILABLE = true;
/** Source repository visibility. Keep false while the repo is private. */
export const PUBLIC_LIBRARY_AVAILABLE = false;

export const PACKAGE_NAME = "@veridox-ai/loupe";
export const PACKAGE_VERSION = "0.1.0";
export const SITE_ORIGIN = "https://tryloupe.lovable.app";
export const PACKAGE_FILE = `veridox-ai-loupe-${PACKAGE_VERSION}.tgz`;
export const PACKAGE_PATH = `/downloads/${PACKAGE_FILE}`;
export const PACKAGE_URL = `${SITE_ORIGIN}${PACKAGE_PATH}`;
export const PACKAGE_SHA256 = "f5707068d5de3ecf75e3e81ae2e458eeadf79eb15992df803a5a8b203bf0f240";
export const PACKAGE_INSTALL_COMMAND = `npm install ${PACKAGE_URL}`;
export const EVALUATION_LICENSE_PATH = "/downloads/LOUPE-EVALUATION-LICENSE.txt";
export const PACKAGE_README_PATH = "/downloads/README.md";
export const CHECKSUMS_PATH = "/downloads/SHA256SUMS.txt";

/** Owner-approved licence summary for the public package. */
export const LICENSE_SUMMARY: string | null =
  "Free for non-production evaluation and prototyping, including internal evaluation by companies. Commercial or production use requires separate written permission from Veridox.";

export const REPO_URL = "https://github.com/AndreiLocota/loupe";
export const REPO_CLONE_URL = `${REPO_URL}.git`;
export const RELEASE_TAG = "library-preview-2026-09-28";
export const RELEASE_URL = `${REPO_URL}/releases/tag/${RELEASE_TAG}`;
export const DOCS_URL = `${REPO_URL}/blob/main/docs/getting-started.md`;
export const EXAMPLE_URL = `${REPO_URL}/blob/main/examples/viewer-app.tsx`;
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;

export const NODE_VERSION = "Node.js 24 LTS";

/** Shown next to source-repository links while the repository is private. */
export const ACCESS_NOTE = PUBLIC_LIBRARY_AVAILABLE
  ? null
  : "The source repository is private. You don't need it to install or evaluate Loupe.";

export const LINK_ACCESS_SUFFIX = PUBLIC_LIBRARY_AVAILABLE ? "" : " (requires repository access)";
