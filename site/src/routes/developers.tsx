import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowUpRight, Check, ChevronDown, Lock, Minus } from "lucide-react";

import { CodePanel } from "@/components/loupe/code-panel";
import {
  API_CARDS,
  API_SNIPPET,
  MATRIX_COLUMNS,
  MATRIX_ROWS,
  PACKAGES,
  RUNTIME_ASSETS,
} from "@/components/loupe/site-data";
import {
  ACCESS_NOTE,
  DOCS_URL,
  EXAMPLE_URL,
  EXAMPLES_URL,
  INSTALL_COMMAND,
  LICENSE_SUMMARY,
  LICENSE_URL,
  LINK_ACCESS_SUFFIX,
  NODE_VERSION,
  PACK_COMMAND,
  QUICKSTART,
  RELEASE_URL,
  REPO_URL,
} from "@/lib/release";

const TITLE = "Loupe for developers — add document viewing to your app";
const DESCRIPTION =
  "Headless TypeScript document viewer for PDF, DOCX and images with optional React bindings. Quick start, integration steps and format support.";

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
  { id: "quick-start", label: "Quick start" },
  { id: "integrate", label: "Integrate" },
  { id: "what-you-tried", label: "What you tried" },
  { id: "api", label: "API excerpt" },
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
  if (value === "optional") return <span className="font-mono text-xs text-navy-soft">opt-in</span>;
  return <span className="font-mono text-xs text-navy-soft">{value}</span>;
}

function AccessNotice() {
  if (!ACCESS_NOTE) return null;
  return (
    <p className="mb-5 flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
      <Lock className="mt-0.5 size-4 shrink-0 text-cobalt" aria-hidden />
      <span>{ACCESS_NOTE}</span>
    </p>
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
        <div className="relative mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
          <p className="eyebrow">Loupe for developers</p>
          <h1 className="mt-3 max-w-2xl text-3xl leading-[1.1] font-semibold sm:text-5xl">
            Add document viewing to your app.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            A headless TypeScript core that renders PDF, DOCX and images in the browser, with
            optional React bindings. You build the interface. No hosted API account, key or backend
            is required at runtime.
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
      </section>

      <main className="mx-auto max-w-5xl space-y-16 px-5 py-14 sm:px-8">
        <section id="quick-start" aria-labelledby="quick-start-title">
          <H2 id="quick-start" eyebrow="Step 1" title="Quick start" />
          <AccessNotice />
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            Use {NODE_VERSION}. Clone, build and run the local reference viewer:
          </p>
          <CodePanel code={QUICKSTART} label="Terminal" />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Then open <code className="font-mono text-foreground">{EXAMPLES_URL}</code> and choose a
            Word, PDF or image file.
          </p>
        </section>

        <section id="integrate" aria-labelledby="integrate-title">
          <H2 id="integrate" eyebrow="Step 2" title="Integrate into your app" />
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            From the clone (after the build above), pack the packages:
          </p>
          <CodePanel code={PACK_COMMAND} label="In the loupe checkout" />
          <p className="my-4 text-sm leading-relaxed text-muted-foreground">
            From your application folder, install Core, DOCX and React together. Adjust{" "}
            <code className="font-mono text-foreground">../loupe</code> to your checkout path.
          </p>
          <CodePanel code={INSTALL_COMMAND} label="In your application" />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Loupe is a five-package workspace, so it is not installed from a public npm scope or
            with <code className="font-mono">npm install AndreiLocota/loupe</code>.
          </p>
          <ul className="mt-5 space-y-2 text-sm">
            <li>
              Prebuilt archives: <Ext href={RELEASE_URL}>Release library-preview-2026-09-28</Ext>
            </li>
            <li>
              Full integration and runtime asset guide: <Ext href={DOCS_URL}>Getting started</Ext>
            </li>
            <li>
              Working example source: <Ext href={EXAMPLE_URL}>examples/viewer-app.tsx</Ext>
            </li>
          </ul>
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
          <H2 id="api" eyebrow="API" title="Adapter setup excerpt" />
          <CodePanel code={API_SNIPPET} label="Excerpt — adapter setup, not a complete app" />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            This only registers the DOCX adapter on a viewer store. For a complete runnable viewer
            see <Ext href={EXAMPLE_URL}>examples/viewer-app.tsx</Ext>. APIs are pre-1.0 and can
            change.
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
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Packages</h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {PACKAGES.map((p) => (
                <li key={p.name} className="text-sm">
                  <code className="font-mono text-[0.8125rem] text-cobalt">{p.name}</code>
                  <span className="block text-xs text-muted-foreground">{p.note}</span>
                </li>
              ))}
            </ul>
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
                {MATRIX_ROWS.map((row) => (
                  <tr key={row.format} className="border-b border-border/70 last:border-0">
                    <th scope="row" className="p-3 text-left align-top">
                      <span className="font-semibold">{row.format}</span>
                      <span className="block font-mono text-[0.6875rem] font-normal text-muted-foreground">
                        {row.detail}
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
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Image support does not include OCR, so images have no text selection or search.
          </p>
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
          </details>
        </section>

        <section id="license" aria-labelledby="license-title">
          <H2 id="license" eyebrow="Terms" title="Licence" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            {LICENSE_SUMMARY ? `${LICENSE_SUMMARY} ` : ""}
            The repository&apos;s <Ext href={LICENSE_URL}>LICENSE</Ext> is the definitive terms.
            Source: <Ext href={REPO_URL}>AndreiLocota/loupe</Ext>
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
