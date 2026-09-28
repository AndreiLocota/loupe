/** Protocols a document hyperlink may carry out of the viewer. Everything else
 * (javascript:, data:, vbscript:, file:, blob:, …) is dropped. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Normalise an external hyperlink target from an untrusted document and decide
 * whether it may be surfaced to the host. Returns the canonical (URL-parsed)
 * form for allowed targets, or null for anything else.
 *
 * The canonical form is what must be relayed: hostile documents can smuggle
 * scheme-shaped strings that parse as *relative* URLs (e.g. `java%73cript:…`,
 * `jav&#97;script:…` — percent/entity escapes are not valid scheme characters,
 * so the WHATWG URL parser resolves them against the page and reports
 * http/https). Checking the parsed protocol alone would let those raw strings
 * through; relaying `url.href` instead of the raw target guarantees the value
 * handed to the host is always a genuine http(s)/mailto URL.
 *
 * Relative URLs resolve against the current page (so they normalise to
 * http/https and pass); anything that does not parse fails closed.
 */
export function normalizeLinkTarget(href: string): string | null {
  if (href.trim() === "") return null;
  try {
    const url = new URL(href, globalThis.location?.href);
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Whether an external hyperlink target from an untrusted document may be
 * surfaced to the host (see {@link normalizeLinkTarget}). */
export function isAllowedLinkTarget(href: string): boolean {
  return normalizeLinkTarget(href) !== null;
}
