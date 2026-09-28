import { describe, expect, it } from "vitest";
import { isAllowedLinkTarget, normalizeLinkTarget } from "../src/links.js";

describe("isAllowedLinkTarget", () => {
  it.each([
    "http://example.com",
    "https://example.com/path?q=1#frag",
    "mailto:someone@example.com",
    // Relative URLs resolve against the page and normalise to http(s).
    "/relative/path",
    "relative.html",
  ])("allows %s", (href) => {
    expect(isAllowedLinkTarget(href)).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox",
    "file:///etc/passwd",
    "blob:https://example.com/uuid",
    "ftp://example.com/file",
    "about:blank",
  ])("drops %s", (href) => {
    expect(isAllowedLinkTarget(href)).toBe(false);
  });
});

describe("normalizeLinkTarget", () => {
  it("returns the canonical URL for allowed targets", () => {
    expect(normalizeLinkTarget("https://EXAMPLE.com/a")).toBe(
      "https://example.com/a",
    );
    expect(normalizeLinkTarget("mailto:x@y.z")).toBe("mailto:x@y.z");
  });

  it("resolves relative targets against the page", () => {
    expect(normalizeLinkTarget("relative.html")).toMatch(/^https?:\/\//);
  });

  it("returns null for disallowed schemes", () => {
    for (const href of [
      "javascript:alert(1)",
      "data:text/html,x",
      "vbscript:msgbox",
      "file:///etc/passwd",
      "blob:http://x/id",
      "ms-msdt:whatever",
    ]) {
      expect(normalizeLinkTarget(href), href).toBeNull();
    }
  });

  it("returns null for strings that fail to parse as URLs", () => {
    expect(normalizeLinkTarget("http://[")).toBeNull();
    expect(normalizeLinkTarget("")).toBeNull();
  });

  // Scheme-shaped strings that parse as RELATIVE urls (escaped scheme
  // characters are not valid in a scheme) must never be relayed verbatim: the
  // canonical form returned by normalizeLinkTarget defuses them.
  it.each([
    "java%73cript:alert(1)",
    "jav&#97;script:alert(1)",
    "javascript&#58;alert(1)",
  ])("defuses smuggled scheme string %s", (href) => {
    const normalized = normalizeLinkTarget(href);
    // Either dropped entirely, or canonicalised to a genuine page-relative URL.
    expect(normalized === null || /^https?:\/\/[^:]+:?/.test(normalized) === true).toBe(
      true,
    );
    if (normalized !== null) {
      expect(normalized.startsWith("javascript")).toBe(false);
      expect(normalized.startsWith("java%73")).toBe(false);
    }
  });
});
