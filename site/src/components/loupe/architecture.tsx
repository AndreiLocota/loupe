import { useState } from "react";
import { ChevronRight } from "lucide-react";

const NODES = [
  {
    id: "file",
    label: "File",
    info: "A PDF, DOCX or image supplied by your application — from an upload, a fetch or your own storage. Loupe reads it in the browser.",
  },
  {
    id: "adapter",
    label: "Format adapter",
    info: "The adapter for that format (loupe-pdf, loupe-docx or loupe-image) parses the file and exposes pages, geometry and per-format capabilities.",
  },
  {
    id: "store",
    label: "ViewerStore",
    info: "The headless core. It holds viewer state — current page, zoom, selection, search matches — and knows nothing about your UI.",
  },
  {
    id: "ui",
    label: "Your UI",
    info: "You build the toolbar, sidebar, overlays and layout. Loupe renders the document surface; the chrome around it is entirely yours.",
  },
];

export function ArchitectureDiagram() {
  const [openId, setOpenId] = useState<string>("store");
  const open = NODES.find((n) => n.id === openId);

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        {NODES.map((n, i) => (
          <div key={n.id} className="flex items-center gap-2 sm:flex-1">
            <button
              type="button"
              onClick={() => setOpenId(n.id)}
              aria-pressed={openId === n.id}
              className={`focus-ring w-full rounded-lg border px-3 py-3 text-center text-sm font-medium transition-colors ${
                openId === n.id
                  ? "border-cobalt bg-cobalt-soft text-navy"
                  : "border-border bg-card text-muted-foreground hover:border-navy/25 hover:text-foreground"
              }`}
            >
              {n.label}
            </button>
            {i < NODES.length - 1 ? (
              <ChevronRight
                aria-hidden
                className="size-4 shrink-0 rotate-90 text-muted-foreground sm:rotate-0"
              />
            ) : null}
          </div>
        ))}
      </div>

      <p aria-live="polite" className="mt-4 rounded-lg border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">{open?.label}. </span>
        {open?.info}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        This diagram is explanatory only — it does not open or analyse any file.
      </p>
    </div>
  );
}

