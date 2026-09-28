# Security Policy

## Supported Versions

All `@veridox-ai/loupe-*` packages are currently **pre-release** (0.x, currently
`0.1.0`); there is no stable `1.x` line yet. During pre-release, security fixes
land on the latest published `0.x` and are not backported.

| Version | Supported |
|---|---|
| 0.x (pre-release, current) | Yes — fixes on the latest `0.x` |
| 1.x   | Not yet released |

## Threat Model

This library renders **untrusted documents** (PDF, DOCX, images) in the browser. The classes of attack we defend against:

1. **Embedded JavaScript** — PDF JS actions, XFA scripting → never enabled; regression-tested
2. **HTML/URL injection** — DOCX renders to canvas (Rust→WASM engine), so document content never becomes live markup; hyperlink targets pass a `http(s)`/`mailto` allowlist and are never auto-navigated
3. **Script execution via SVG** → the image adapter renders SVG exclusively via `<img src=blob:>` (no inline SVG in the live DOM); DOCX thumbnails render via the WASM engine to `ImageBitmap` — see [`docs/SECURITY.md`](docs/SECURITY.md)
4. **Memory-corruption bugs** in native decoders → isolated in Web Workers + WASM sandbox
5. **Decompression bombs** → input size caps, expansion ratio limits, dimension caps (adapter zip hygiene plus the DOCX engine's own budgets)
6. **Exfiltration/tracking** → zero network requests from document content (tested invariant)
7. **Supply chain** → pinned deps (incl. exact-pinned `@silurus/ooxml`), vendored one-maintainer packages, self-hosted WASM assets

## Reporting a Vulnerability

**Do not file a public issue.** Email the Veridox security team at
[security@veridox.ai](mailto:security@veridox.ai).

Include:
- The format and a minimal reproducer document
- The affected package and version
- Whether the issue is exploitable across the CSP boundary

## Embedder Responsibilities

The library guarantees these invariants when the host app applies the documented CSP:

```
script-src 'self' 'wasm-unsafe-eval';
worker-src 'self' blob:;
img-src 'self' blob:;
object-src 'none'
```

See [`docs/SECURITY.md`](docs/SECURITY.md) for the full embedder security guide.
