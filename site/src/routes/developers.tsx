import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowUpRight, Check, ChevronDown, Download, Minus } from "lucide-react";

import { AgentPrompt } from "@/components/loupe/agent-prompt";
import { CodePanel } from "@/components/loupe/code-panel";
import { LaunchVideo } from "@/components/loupe/launch-video";
import {
  API_CARDS,
  ASSETS_COMMAND,
  ASSETS_SNIPPET,
  CLEANUP_SNIPPET,
  ENTRY_POINTS,
  HTML_SNIPPET,
  MATRIX_COLUMNS,
  DEVELOPER_FORMAT_ROWS,
  RUNTIME_ASSETS,
  VITE_SNIPPET,
} from "@/components/loupe/site-data";
import {
  ACCESS_NOTE,
  EVALUATION_LICENSE_PATH,
  LICENSE_SUMMARY,
  LICENSE_URL,
  LINK_ACCESS_SUFFIX,
  NODE_VERSION,
  PACKAGE_INSTALL_COMMAND,
  PACKAGE_NAME,
  PACKAGE_README_PATH,
  PACKAGE_SHA256,
  PACKAGE_URL,
  PACKAGE_VERSION,
  REPO_URL,
  CHECKSUMS_PATH,
} from "@/lib/release";

const TITLE = "Loupe for developers — add document viewing to your app";
const DESCRIPTION =
  "Install one package for PDF, Word and image viewing in your app, with optional React bindings. Free for evaluation and prototyping.";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DevelopersPage,
});

const NAV = [
  { id: "install", label: "Install" },
  { id: "ai-agent", label: "AI agent" },
  { id: "integrate", label: "Open a Word file" },
  { id: "what-you-tried", label: "What you tried" },
  { id: "api", label: "API" },
  { id: "formats", label: "Format support" },
  { id: "runtime-assets", label: "Runtime assets" },
  { id: "license", label: "Licence" },
];

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="focus-ring inline-flex items-center gap-1 font-medium text-cobalt underline-offset-4 hover:underline"
    >
      {children}
      <ArrowUpRight className="size-3.5" aria-hidden />
      {LINK_ACCESS_SUFFIX ? (
        <span className="text-xs font-normal text-muted-foreground">{LINK_ACCESS_SUFFIX}</span>
      ) : null}
    </a>
  );
}

function H2({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={`${id}-title`} className="mt-2 text-2xl font-semibold">
        {title}
      </h2>
    </div>
  );
}

function Cell({ value }: { value: string }) {
  if (value === "yes")
    return (
      <>
        <Check className="mx-auto size-4 text-cobalt" aria-hidden />
        <span className="sr-only">Supported</span>
      </>
    );
  if (value === "no")
    return (
      <>
        <Minus className="mx-auto size-4 text-muted-foreground/50" aria-hidden />
        <span className="sr-only">Not provided</span>
      </>
    );
  if (value === "optional")
    return (
      <span className="font-mono text-xs text-navy-soft">
        opt-in<span className="sr-only"> (supported when enabled)</span>
      </span>
    );
  return <span className="font-mono text-xs text-navy-soft">{value}</span>;
}

function Local({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="focus-ring inline-flex items-center gap-1 font-medium text-cobalt underline-offset-4 hover:underline"
    >
      {children}
    </a>
  );
}

function DevelopersPage() {
  // Never inherit the inspector palette or dark mode after leaving the demo.
  useEffect(() => {
    document.documentElement.classList.remove("loupe-try-active", "dark");
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
          <span className="font-display text-[1.0625rem] font-semibold tracking-[-0.04em]">
            Loupe
            <span className="ml-1.5 align-middle font-mono text-[0.625rem] font-normal tracking-[0.16em] text-muted-foreground uppercase">
              for developers
            </span>
          </span>
          <div className="flex items-center gap-3">
            <Link to="/playground" className="focus-ring text-sm font-medium text-cobalt">
              Playground
            </Link>
            <Link
              to="/"
              className="focus-ring rounded-md bg-cobalt px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Try Loupe
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="grid-backdrop absolute inset-0 opacity-60" />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-transparent to-background"
        />
        <div className="relative mx-auto grid max-w-5xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
          <p className="eyebrow">Loupe for developers</p>
          <h1 className="mt-3 max-w-2xl text-3xl leading-[1.1] font-semibold sm:text-5xl">
            Add document viewing to your app.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            One package renders PDF, Word and images in the browser, with optional React bindings.
            You build the interface. No API key, account or hosted backend is required at runtime.
          </p>
          <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="focus-ring text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {n.label}
              </a>
            ))}
          </nav>
          </div>
          <div className="w-full lg:w-[380px]">
            <LaunchVideo />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl space-y-16 px-5 py-14 sm:px-8">
        <section id="install" aria-labelledby="install-title">
          <H2 id="install" eyebrow="Step 1" title="Install" />
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            Run this in your application folder:
          </p>
          <CodePanel code={PACKAGE_INSTALL_COMMAND} label="Terminal" />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={PACKAGE_URL}
              download
              className="focus-ring inline-flex items-center gap-2 rounded-md bg-cobalt px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Download className="size-4" aria-hidden />
              Download package
            </a>
            <Local href={EVALUATION_LICENSE_PATH}>Evaluation licence</Local>
            <Local href={PACKAGE_README_PATH}>Package README</Local>
            <Ext href={REPO_URL}>Source on GitHub</Ext>
          </div>
          <ul className="mt-5 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
            <li>
              One package (<code className="font-mono text-foreground">{PACKAGE_NAME}</code>{" "}
              {PACKAGE_VERSION}) includes PDF, Word, images and optional React bindings.
            </li>
            <li>No GitHub account, repository clone or Loupe build is needed.</li>
            <li>Your app still needs a bundler, such as Vite. We develop with {NODE_VERSION}.</li>
            <li>
              Downloaded from the Loupe GitHub release, not the public npm registry.{" "}
              <Local href={CHECKSUMS_PATH}>SHA-256</Local>:{" "}
              <code className="font-mono text-[0.6875rem] break-all">{PACKAGE_SHA256}</code>
            </li>
          </ul>
        </section>

        <section id="ai-agent" aria-labelledby="ai-agent-title">
          <H2 id="ai-agent" eyebrow="Shortcut" title="Let your AI agent do it" />
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            Copy this JSON into your coding agent to add Loupe to your app.
          </p>
          <AgentPrompt />
        </section>

        <section id="integrate" aria-labelledby="integrate-title">
          <H2 id="integrate" eyebrow="Step 2" title="Open a Word file" />
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            In a browser app using Vite, add a file input and a viewer element with a definite
            height:
          </p>
          <CodePanel code={HTML_SNIPPET} label="index.html" />
          <p className="my-4 text-sm leading-relaxed text-muted-foreground">
            Create a viewer, register the Word adapter, mount it and load the chosen file:
          </p>
          <CodePanel code={VITE_SNIPPET} label="main.ts" />
          <p className="my-4 text-sm leading-relaxed text-muted-foreground">Clean up when done:</p>
          <CodePanel code={CLEANUP_SNIPPET} label="Cleanup" />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            For PDF use <code className="font-mono text-foreground">createPdfAdapterFactory</code>{" "}
            from <code className="font-mono text-foreground">{PACKAGE_NAME}/pdf</code>; for
            images use <code className="font-mono text-foreground">createImageAdapterFactory</code>{" "}
            from <code className="font-mono text-foreground">{PACKAGE_NAME}/image</code>. Vite
            emits the PDF, TIFF and Word workers and the WASM file automatically. In SSR apps,
            import adapters only in browser code.{" "}
            <Link
              to="/playground"
              className="focus-ring font-medium text-cobalt underline-offset-4 hover:underline"
            >
              The playground
            </Link>{" "}
            shows eight sample formats.
          </p>
        </section>

        <section id="what-you-tried" aria-labelledby="what-you-tried-title">
          <H2 id="what-you-tried" eyebrow="Context" title="What you tried" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">The Loupe library</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Renders, searches, selects text, zooms and navigates documents. That is what you get
                in your app.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">The Word inspector</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Adds retained changes, comments, findings and a timeline. These are demo application
                features, not part of the library API.
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            The browser demo currently accepts Word files only; the local reference viewer handles
            every supported format.{" "}
            <Link
              to="/"
              className="focus-ring font-medium text-cobalt underline-offset-4 hover:underline"
            >
              Back to the demo
            </Link>
          </p>
        </section>

        <section id="api" aria-labelledby="api-title">
          <H2 id="api" eyebrow="API" title="Entry points" />
          <div className="rounded-xl border border-border bg-card p-5">
            <ul className="grid gap-2 sm:grid-cols-2">
              {ENTRY_POINTS.map((p) => (
                <li key={p.path} className="text-sm">
                  <code className="font-mono text-[0.8125rem] text-cobalt">{p.path}</code>
                  <span className="block text-xs text-muted-foreground">{p.note}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            React is optional: <code className="font-mono text-foreground">/react</code> uses your
            app&apos;s own React and React DOM 18 or newer. APIs are pre-1.0 and can change.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {API_CARDS.map((c) => (
              <div key={c.symbol} className="rounded-xl border border-border bg-card p-4">
                <p className="flex items-baseline justify-between gap-2">
                  <code className="font-mono text-[0.8125rem] font-medium text-cobalt">
                    {c.symbol}
                  </code>
                  <span className="eyebrow">{c.kind}</span>
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {c.description}
                </p>
                {c.members ? (
                  <p className="mt-2 font-mono text-[0.6875rem] leading-relaxed text-navy-soft">
                    {c.members.join(" · ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section id="formats" aria-labelledby="formats-title">
          <H2 id="formats" eyebrow="Capabilities" title="Format support" />
          <div className="scroll-x-safe w-full max-w-full min-w-0 rounded-xl border border-border bg-card shadow-panel">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <caption className="sr-only">Feature support by document format in Loupe</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="p-3 text-left text-xs font-semibold">
                    Format
                  </th>
                  {MATRIX_COLUMNS.map((c) => (
                    <th
                      key={c}
                      scope="col"
                      className="p-3 text-center text-xs font-medium text-muted-foreground"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEVELOPER_FORMAT_ROWS.map((row) => (
                  <tr key={row.format} className="border-b border-border/70 last:border-0">
                    <th scope="row" className="p-3 text-left align-top whitespace-nowrap">
                      <span className="font-semibold">{row.format}</span>{" "}
                      <span className="font-mono text-xs font-normal text-navy-soft">
                        {row.extensions.join(", ")}
                      </span>
                      <span className="block font-mono text-[0.6875rem] font-normal text-muted-foreground">
                        {row.entry}
                      </span>
                    </th>
                    {row.values.map((v, i) => (
                      <td key={i} className="p-3 text-center align-middle">
                        <Cell value={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Key: check = supported, dash = not provided, opt-in = off by default, enable in adapter options.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>Word thumbnails are opt-in. DOCM files are viewed as Word documents; macros are never run.</li>
            <li>Only TIFF exposes pages, thumbnails and rotation among images; other images are a single view without rotation.</li>
            <li>HEIC and HEIF use a decoder that loads only when such a file is opened.</li>
            <li>No OCR: images have no text selection or search. PDF search and selection need text in the document.</li>
          </ul>
        </section>

        <section id="runtime-assets" aria-labelledby="runtime-assets-title">
          <H2 id="runtime-assets" eyebrow="Embedding" title="Runtime assets" />
          <details className="group rounded-xl border border-border bg-card">
            <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-sm font-medium">
              Workers and WASM your application serves
              <ChevronDown
                className="size-4 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <ul className="grid gap-4 border-t border-border p-5 sm:grid-cols-2">
              {RUNTIME_ASSETS.map((a) => (
                <li key={a.title}>
                  <h3 className="text-sm font-semibold">{a.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
                </li>
              ))}
            </ul>
            <div className="border-t border-border p-5">
              <h3 className="text-sm font-semibold">If your bundler needs explicit URLs</h3>
              <p className="mt-1 mb-3 text-sm leading-relaxed text-muted-foreground">
                Copy the assets into your public folder (repeat when upgrading), then pass the URLs:
              </p>
              <CodePanel code={ASSETS_COMMAND} label="Terminal" />
              <div className="mt-3">
                <CodePanel code={ASSETS_SNIPPET} label="Explicit asset URLs" />
              </div>
            </div>
          </details>
        </section>

        <section id="license" aria-labelledby="license-title">
          <H2 id="license" eyebrow="Terms" title="Licence" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            {LICENSE_SUMMARY} Loupe is not open source. The{" "}
            <Local href={EVALUATION_LICENSE_PATH}>evaluation licence</Local> is the complete terms
            for the package and the source.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Source on GitHub, under the same evaluation terms (
            <Ext href={LICENSE_URL}>LICENSE</Ext>): <Ext href={REPO_URL}>AndreiLocota/loupe</Ext>
          </p>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="font-display font-semibold tracking-[-0.04em]">Loupe</span>
          <Link to="/" className="focus-ring text-cobalt underline-offset-4 hover:underline">
            Try Loupe →
          </Link>
        </div>
      </footer>
    </div>
  );
}
