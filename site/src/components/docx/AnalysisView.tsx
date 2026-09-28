import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Moon, Sun, UploadCloud, History } from "lucide-react";
import type { DocxAnalysis } from "@/lib/docx/types";
import { Timeline } from "./Timeline";
import { FindingsPanel } from "./FindingsPanel";
import { LoupeViewer } from "./LoupeViewer";
import { BuiltWithLoupe } from "./BuiltWithLoupe";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  analysis: DocxAnalysis;
  file: File;
  onReset: () => void;
  dark: boolean;
  onToggleDark: () => void;
  /** Landing route this document arrived from, carried through to the CTA. */
  source?: string | undefined;
}




export function AnalysisView({ analysis, file, onReset, dark, onToggleDark, source }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [types, setTypes] = useState({ insertion: true, deletion: true, comment: true });
  const [authorsOff, setAuthorsOff] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"doc" | "details" | "meta">("doc");

  const { meta, events, sessions, authors } = analysis;

  // With no retained edits there is no history to filter or plot: the space
  // goes to the findings instead of an empty chronology.
  const hasHistory = events.length > 0;
  const datedEvents = events.filter((e) => e.date);
  const showTimeline = datedEvents.length > 0;


  const visibleEvents = events.filter((e) => types[e.type] && !authorsOff[e.author]);

  const counts = {
    insertion: events.filter((e) => e.type === "insertion").length,
    deletion: events.filter((e) => e.type === "deletion").length,
    comment: events.filter((e) => e.type === "comment").length,
  };

  const select = (id: string) => {
    setActiveId(id);
    setTab("doc");
  };

  // Open on a real retained finding so the evidence is discoverable at a glance.
  useEffect(() => {
    const first = events.find((e) => e.type === "comment") ?? events[0];
    setActiveId(first ? first.id : null);
  }, [events]);


  return (
    <div className="flex h-screen max-h-[100dvh] min-h-0 flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-2 sm:gap-4 sm:px-6 sm:py-3">
        <span className="flex shrink-0 items-center gap-2 border-r border-border pr-3 font-display text-base font-semibold tracking-tight text-foreground sm:pr-4">
          <span aria-hidden className="size-2 rounded-full bg-primary" />
          Loupe
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground sm:flex-none">
          {meta.fileName}
        </span>
        <span className="hidden truncate text-xs text-muted-foreground lg:inline">
          {meta.lastModifiedBy ?? meta.creator ?? "unknown author"}
          {meta.modified ? ` · ${new Date(meta.modified).toLocaleDateString()}` : ""}
        </span>
        <BuiltWithLoupe className="ml-auto hidden shrink-0 md:block" />
        <Link
          to="/developers"
          className="shrink-0 rounded-sm text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:ml-0 ml-auto"
        >
          <span className="sm:hidden">Developers</span>
          <span className="hidden sm:inline">For developers →</span>
        </Link>

        <button
          onClick={onToggleDark}
          aria-label="Toggle dark mode"
          className="shrink-0 rounded-sm p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <button
          onClick={onReset}
          aria-label="New file"
          className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:px-4"
        >
          <UploadCloud className="size-4" />
          <span className="hidden sm:inline">New file</span>
        </button>
      </header>


      {/* Mobile tabs */}
      <div className={cn("grid shrink-0 border-b border-border bg-card md:hidden", hasHistory ? "grid-cols-3" : "grid-cols-2")}>
        {(
          (hasHistory
            ? ([
                ["doc", "Document"],
                ["details", "Details"],
                ["meta", "Findings"],
              ] as const)
            : ([
                ["doc", "Document"],
                ["meta", "Findings"],
              ] as const))
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "border-b-2 py-2 text-xs font-medium transition-colors",
              tab === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Body: left details · document · right details */}
      <div className={cn("grid min-h-0 flex-1 grid-cols-1 overflow-hidden",
          hasHistory
            ? "md:grid-cols-[19%_minmax(0,1fr)_25%]"
            : "md:grid-cols-[minmax(0,1fr)_clamp(20rem,36%,30rem)]",
        )}>
        {hasHistory && (
        <aside
          className={cn(
            "min-h-0 min-w-0 flex-col overflow-y-auto bg-background px-4 py-5 font-sans md:flex",
            tab === "details" ? "flex" : "hidden",
          )}
        >

          <section>
            <span className="label-micro">Findings</span>
            <div className="mt-2 flex flex-col">
              {(
                [
                  ["insertion", "Insertions", "bg-ins-soft ring-ins/40", counts.insertion],
                  ["deletion", "Deletions", "bg-del-soft ring-del/40", counts.deletion],
                  ["comment", "Comments", "bg-note-soft ring-note/40", counts.comment],
                ] as const
              ).map(([key, label, swatch, count]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={types[key]}
                    onChange={() => setTypes((t) => ({ ...t, [key]: !t[key] }))}
                    className="size-3.5 shrink-0 accent-primary"
                  />
                  <span className={cn("size-3 shrink-0 rounded ring-1", swatch)} />
                  <span className={cn("flex-1 truncate", !types[key] && "text-muted-foreground")}>
                    {label}
                  </span>
                  <span className="tabular-nums text-foreground">{count}</span>
                </label>
              ))}
              <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                <span className="flex-1 truncate pl-[1.625rem]">Recorded findings</span>
                <span className="tabular-nums text-foreground">{events.length}</span>
              </div>
              <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    tabIndex={0}
                    className="flex cursor-help items-center gap-2 py-1 text-xs text-muted-foreground outline-none"
                  >
                    <span className="flex-1 truncate pl-[1.625rem]">Revision IDs</span>
                    <span className="tabular-nums text-foreground">{sessions.length}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[16rem] text-xs leading-relaxed">
                  Revision IDs are markers Word stores in the file. They are not a reliable count of
                  how many editing sessions took place, or when.
                </TooltipContent>
              </Tooltip>
              </TooltipProvider>
            </div>
          </section>

          {authors.length > 0 && (
            <section className="mt-5 border-t border-border pt-5">
              <span className="label-micro">People</span>
              <div className="mt-2 flex flex-col">
                {authors.map((a) => (
                  <label
                    key={a}
                    className="flex cursor-pointer items-center gap-2 py-1 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={!authorsOff[a]}
                      onChange={() => setAuthorsOff((s) => ({ ...s, [a]: !s[a] }))}
                      className="size-3.5 shrink-0 accent-primary"
                    />
                    <span className={cn("flex-1 truncate", authorsOff[a] && "text-muted-foreground")}>
                      {a}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

        </aside>
        )}

        <main
          className={cn(
            "min-h-0 min-w-0 flex-col overflow-hidden px-1 pb-0 pt-0 md:flex",
            tab === "doc" ? "flex" : "hidden",
          )}
        >
          <LoupeViewer
            file={file}
            analysis={analysis}
            selectedEvent={events.find((e) => e.id === activeId)}
            onSelectEvent={select}
          />

        </main>

        <aside
          className={cn(
            "relative z-40 min-h-0 min-w-0 bg-background md:block",
            tab === "meta" ? "block" : "hidden",
          )}
        >
          <FindingsPanel analysis={analysis} file={file} source={source} activeId={activeId} onSelect={select} />
        </aside>
      </div>


      {showTimeline && (
        <Timeline
          events={visibleEvents.filter((e) => e.date)}
          sessions={sessions}
          activeId={activeId}
          onSelect={select}
        />
      )}
    </div>
  );
}
