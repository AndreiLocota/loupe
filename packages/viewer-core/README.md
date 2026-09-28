# @veridox-ai/loupe-core

Framework-agnostic core of the [Loupe](https://github.com/veridox-ai/tools.loupe)
headless document viewer: the `DocumentAdapter` interface, the `ViewerStore`
state machine, magic-byte format detection, the `ViewerError` taxonomy, the event
bus, and cancellation tokens. Zero DOM-engine dependencies — the per-format
adapters (`@veridox-ai/loupe-pdf`, `-docx`, `-image`) build on this.

```bash
npm install @veridox-ai/loupe-core
```

Consumers talk to `ViewerStore` (or the React hooks in `@veridox-ai/loupe-react`),
never to an engine directly.

- [Getting Started](https://github.com/veridox-ai/tools.loupe/blob/main/docs/getting-started.md)
- [Concepts](https://github.com/veridox-ai/tools.loupe/blob/main/docs/concepts.md)
- [Security](https://github.com/veridox-ai/tools.loupe/blob/main/SECURITY.md)

Proprietary — distributed via Veridox's private registry. See
[LICENSE](https://github.com/veridox-ai/tools.loupe/blob/main/LICENSE).
