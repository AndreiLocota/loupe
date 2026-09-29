/**
 * Single source of truth for Loupe release links and access state.
 * The prebuilt package is published as a public GitHub release asset; the
 * source repository is public on GitHub under the same evaluation terms.
 */

/** Public prebuilt package download (no login needed). */
export const PUBLIC_PACKAGE_AVAILABLE = true;
/** Source repository visibility. */
export const PUBLIC_LIBRARY_AVAILABLE = true;

export const PACKAGE_NAME = "@andreilocota/loupe";
export const PACKAGE_VERSION = "0.1.1";
export const SITE_ORIGIN = "https://tryloupe.lovable.app";
export const PACKAGE_FILE = `andreilocota-loupe-${PACKAGE_VERSION}.tgz`;

export const REPO_URL = "https://github.com/AndreiLocota/loupe";
export const REPO_CLONE_URL = `${REPO_URL}.git`;
export const RELEASE_TAG = "v0.1.1";
export const RELEASE_URL = `${REPO_URL}/releases/tag/${RELEASE_TAG}`;
export const DOCS_URL = `${REPO_URL}/blob/main/docs/getting-started.md`;
export const EXAMPLE_URL = `${REPO_URL}/blob/main/examples/viewer-app.tsx`;
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;

export const PACKAGE_URL = `${REPO_URL}/releases/download/${RELEASE_TAG}/${PACKAGE_FILE}`;
export const PACKAGE_SHA256 = "344edf10623ac5dc661b12cd6742166eda675e419d0accfdf0ea2eca80a1e96b";
export const PACKAGE_INSTALL_COMMAND = `npm install ${PACKAGE_URL}`;
export const EVALUATION_LICENSE_PATH = "/downloads/LOUPE-EVALUATION-LICENSE.txt";
export const PACKAGE_README_PATH = "/downloads/README.md";
export const CHECKSUMS_PATH = "/downloads/SHA256SUMS.txt";

/** Owner-approved licence summary (package and source). */
export const LICENSE_SUMMARY =
  "Free for non-production evaluation and prototyping. Commercial or production use requires written permission.";

export const NODE_VERSION = "Node.js 24 LTS";

/** Kept for compatibility; null/empty now that the source repository is public. */
export const ACCESS_NOTE: string | null = PUBLIC_LIBRARY_AVAILABLE
  ? null
  : "The source repository is private. You don't need it to install or evaluate Loupe.";

export const LINK_ACCESS_SUFFIX = PUBLIC_LIBRARY_AVAILABLE ? "" : " (requires repository access)";
