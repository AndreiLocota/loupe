import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Check, ChevronDown, Minus } from "lucide-react";

import { ArchitectureDiagram } from "@/components/loupe/architecture";
import { CodePanel } from "@/components/loupe/code-panel";
import { DocsSidebar, SiteHeader, Wordmark } from "@/components/loupe/site-nav";
import {
  API_CARDS,
  API_SNIPPET,
  CHIPS,
  DEMO_URL,
  MATRIX_COLUMNS,
  MATRIX_ROWS,
  PACKAGES,
  RUNTIME_ASSETS,
} from "@/components/loupe/site-data";

const TITLE = "Archived: Loupe for Developers — headless document viewer for PDF, DOCX and images";
const DESCRIPTION =
  "Loupe is a framework-agnostic TypeScript document viewer core for PDF, DOCX and images. Render in the browser and build the interface your product needs.";

export const Route = createFileRoute("/original")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { name: "robots", content: "noindex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="mb-8">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={`${id}-title`} className="mt-3 text-2xl font-semibold sm:text-3xl">
        {title}
      </h2>
      {lead ? (
        <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-muted-foreground">
          {lead}
        </p>
      ) : null}
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
    return <span className="font-mono text-xs text-navy-soft">opt-in</span>;
  return <span className="font-mono text-xs text-navy-soft">{value}</span>;
}

function Index() {
  return (
    <div id="top" className="min-h-screen bg-background">
      <div className="border-b border-border bg-secondary/60 px-5 py-2 text-center text-xs text-muted-foreground">
        Archived page, kept for reference. Current guidance:{" "}
        <Link to="/developers" className="focus-ring font-medium text-cobalt underline-offset-4 hover:underline">
          Loupe for developers →
        </Link>
      </div>
      <SiteHeader />

      {/* Hero */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="grid-backdrop absolute inset-0 opacity-70" />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background"
        />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <p className="eyebrow">Document viewer SDK</p>
          <h1
            id="hero-title"
            className="mt-4 max-w-3xl text-4xl leading-[1.05] font-semibold sm:text-6xl"
          >
            Your document.
            <br />
            <span className="text-cobalt">Your interface.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            A headless document viewer for PDF, DOCX and images. Render in the browser. Build the
            interface your product needs.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={DEMO_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg bg-cobalt px-5 py-3 text-sm font-medium text-primary-foreground shadow-panel transition-opacity hover:opacity-90"
            >
              Try the DOCX demo
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
            <a
              href="#api-preview"
              className="focus-ring inline-flex items-center justify-center rounded-lg border border-navy/20 bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-navy/40"
            >
              Explore the API
            </a>
          </div>
          <p className="mt-4 max-w-xl text-xs text-muted-foreground">
            The linked demo is a DOCX viewer. PDF and image rendering are not demonstrated on this
            site.
          </p>

          <ul className="mt-10 flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <li
                key={c}
                className="rounded-full border border-navy/12 bg-card px-3 py-1 font-mono text-xs text-navy-soft"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Body */}
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-16">
        <DocsSidebar />

        <main className="min-w-0 space-y-20">
          {/* Overview */}
          <section id="overview" aria-labelledby="overview-title">
            <SectionHeading
              id="overview"
              eyebrow="Overview"
              title="A viewer core, not a viewer product"
              lead="Loupe is a framework-agnostic TypeScript core that parses and renders documents on the client. It ships no toolbar and no opinion about your layout — the consumer owns the chrome."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold">Packages</h3>
                <ul className="mt-3 space-y-2">
                  {PACKAGES.map((p) => (
                    <li key={p.name} className="text-sm">
                      <code className="font-mono text-[0.8125rem] text-cobalt">{p.name}</code>
                      <span className="block text-xs text-muted-foreground">{p.note}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold">Pre-1.0</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    APIs are pre-1.0 and can change. Treat everything on this page as a preview of
                    the surface rather than a stable reference.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold">Licensing</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Loupe is proprietary software distributed through a private registry. It is not
                    published on public npm and it is not open source.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Capabilities */}
          <section id="capabilities" aria-labelledby="capabilities-title">
            <SectionHeading
              id="capabilities"
              eyebrow="Capabilities"
              title="What each format supports"
              lead="Support differs per adapter. useCapabilities lets your UI gate controls so you never render a button a format cannot honour."
            />

            <div className="scroll-x-safe w-full max-w-full min-w-0 rounded-xl border border-border bg-card shadow-panel">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <caption className="sr-only">
                  Feature support by document format in Loupe
                </caption>
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

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold">Images are pixels, not text</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Broad image format support does not imply OCR. There is no text layer, so text
                  selection and search are not available for images.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold">Overlays belong to your app</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  In the DOCX demo, retained-comment findings and session-local reviewer marks are
                  application overlays drawn with Loupe geometry. They are not native document
                  editing and they do not recover deleted history.
                </p>
              </div>
            </div>
          </section>

          {/* Architecture */}
          <section id="architecture" aria-labelledby="architecture-title">
            <SectionHeading
              id="architecture"
              eyebrow="Architecture"
              title="File → format adapter → ViewerStore → your UI"
              lead="Select a node to read what it is responsible for."
            />
            <ArchitectureDiagram />
          </section>

          {/* API preview */}
          <section id="api-preview" aria-labelledby="api-preview-title">
            <SectionHeading
              id="api-preview"
              eyebrow="API preview"
              title="Registering an adapter"
              lead="This is adapter configuration only — it wires a DOCX adapter into a store. It is not a complete application: loading a document and rendering a surface still belong to your code."
            />

            <CodePanel
              code={API_SNIPPET}
              label="API preview — requires private package access"
              filename="viewer.ts"
            />

            <p className="mt-4 text-xs text-muted-foreground">
              Shown for reading and copying only. The packages are privately distributed, so this
              snippet will not resolve without access.
            </p>

            <h3 className="mt-10 text-sm font-semibold">React bindings</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {API_CARDS.map((card) => (
                <div key={card.symbol} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <code className="font-mono text-[0.8125rem] font-medium text-cobalt">
                      {card.symbol}
                    </code>
                    <span className="font-mono text-[0.625rem] tracking-[0.12em] text-muted-foreground uppercase">
                      {card.kind}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {card.description}
                  </p>
                  {card.members ? (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {card.members.map((m) => (
                        <li
                          key={m}
                          className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[0.6875rem] text-navy-soft"
                        >
                          {m}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              A preview of verified symbols, not a full API reference. React bindings are optional
              and require React 18 or newer.
            </p>
          </section>

          {/* Runtime assets */}
          <section id="runtime-assets" aria-labelledby="runtime-assets-title">
            <SectionHeading
              id="runtime-assets"
              eyebrow="Runtime assets"
              title="Files your host application must serve"
              lead="Some adapters load assets at runtime. Your application is responsible for serving them — this matters most when embedding Loupe inside an existing app."
            />
            <details className="group rounded-xl border border-border bg-card" open>
              <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-3 p-5 text-sm font-medium">
                Asset requirements by adapter
                <ChevronDown
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="border-t border-border px-5 pt-4 pb-5">
                <dl className="space-y-4">
                  {RUNTIME_ASSETS.map((a) => (
                    <div key={a.title} className="grid gap-1 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-4">
                      <dt className="font-mono text-xs tracking-[0.1em] text-cobalt uppercase">
                        {a.title}
                      </dt>
                      <dd className="text-sm leading-relaxed text-muted-foreground">{a.body}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </details>
          </section>

          {/* Availability */}
          <section id="availability" aria-labelledby="availability-title">
            <SectionHeading id="availability" eyebrow="Availability" title="Access and licensing" />
            <div className="rounded-xl border border-navy/15 bg-navy p-7 text-primary-foreground shadow-lift sm:p-9">
              <p className="max-w-2xl text-lg leading-relaxed">
                Explore the working demo today. Developer packages are privately distributed; access
                and licensing are not self-serve.
              </p>
              <a
                href={DEMO_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="focus-ring mt-6 inline-flex items-center gap-1.5 rounded-lg bg-primary-foreground px-5 py-3 text-sm font-medium text-navy transition-opacity hover:opacity-90"
              >
                Try the DOCX demo
                <ArrowUpRight className="size-4" aria-hidden />
              </a>
            </div>
          </section>
        </main>
      </div>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Wordmark />
          <p className="text-xs text-muted-foreground">
            Proprietary software. Pre-1.0 APIs subject to change.
          </p>
        </div>
      </footer>
    </div>
  );
}
