import { Fragment } from "react";
import type { DocBlock, DocNode, DocRun, EditEvent } from "@/lib/docx/types";
import { cn } from "@/lib/utils";

export interface ViewerFilters {
  insertion: boolean;
  deletion: boolean;
  comment: boolean;
  authors: Record<string, boolean>;
}

interface Props {
  nodes: DocNode[];
  events: EditEvent[];
  filters: ViewerFilters;
  activeId: string | null;
}

function eventVisible(e: EditEvent | undefined, filters: ViewerFilters) {
  if (!e) return false;
  if (!filters[e.type]) return false;
  if (filters.authors[e.author] === false) return false;
  return true;
}

function RunSpan({
  run,
  events,
  filters,
  activeId,
}: {
  run: DocRun;
  events: Map<string, EditEvent>;
  filters: ViewerFilters;
  activeId: string | null;
}) {
  const event = run.eventId ? events.get(run.eventId) : undefined;
  const marked = run.change ? eventVisible(event, filters) : false;
  const commentIds = (run.commentIds ?? []).filter((id) => eventVisible(events.get(`c-${id}`), filters));

  if (run.change === "del" && !marked) return null;

  const isActive = activeId != null && (activeId === run.eventId || commentIds.some((id) => `c-${id}` === activeId));

  return (
    <span
      id={run.eventId ? `edit-${run.eventId}` : undefined}
      data-comment={commentIds[0] ? `c-${commentIds[0]}` : undefined}
      title={event ? `${event.author}${event.date ? ` · ${new Date(event.date).toLocaleString()}` : ""}` : undefined}
      className={cn(
        "whitespace-pre-wrap",
        run.bold && "font-semibold",
        run.italic && "italic",
        run.underline && "underline",
        marked && run.change === "ins" && "rounded-[3px] bg-ins-soft text-ins underline decoration-ins/60 underline-offset-2",
        marked && run.change === "del" && "rounded-[3px] bg-del-soft text-del line-through",
        commentIds.length > 0 && "rounded-[3px] bg-note-soft/70 text-foreground",
        isActive && "edit-pulse",
      )}
    >
      {run.text}
      {commentIds.map((id) => {
        const e = events.get(`c-${id}`);
        return (
          <sup key={id} id={`edit-c-${id}`} className="ml-0.5 rounded bg-note px-1 text-[10px] font-bold text-background">
            {e?.marker ?? "•"}
          </sup>
        );
      })}
    </span>
  );
}

function Block({
  block,
  events,
  filters,
  activeId,
}: {
  block: DocBlock;
  events: Map<string, EditEvent>;
  filters: ViewerFilters;
  activeId: string | null;
}) {
  const content = block.runs.map((run, i) => (
    <RunSpan key={i} run={run} events={events} filters={filters} activeId={activeId} />
  ));

  const empty = block.runs.length === 0;
  if (empty) return <div className="h-4" />;

  switch (block.type) {
    case "h1":
      return <h2 className="mt-8 font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">{content}</h2>;
    case "h2":
      return <h3 className="mt-8 font-[family-name:var(--font-display)] text-xl font-bold text-foreground">{content}</h3>;
    case "h3":
      return <h4 className="mt-8 font-[family-name:var(--font-display)] text-base font-bold text-foreground">{content}</h4>;
    case "quote":
      return <blockquote className="my-4 border-l-2 border-primary/40 pl-4 italic text-muted-foreground">{content}</blockquote>;
    case "li":
      return (
        <li className="ml-5 list-disc py-0.5 leading-[1.85] text-foreground marker:text-muted-foreground">{content}</li>
      );
    default:
      return <p className="py-1.5 leading-[1.85] text-foreground">{content}</p>;
  }
}

export function DocumentViewer({ nodes, events, filters, activeId }: Props) {
  const map = new Map(events.map((e) => [e.id, e]));

  return (
    <article className="font-[family-name:var(--font-doc)] text-[15px]">
      {nodes.map((node) => {
        if (node.kind === "table") {
          return (
            <div key={node.id} className="my-5 overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {node.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-border last:border-0">
                      {row.map((cell, ci) => (
                        <td key={ci} className="border-r border-border p-3 align-top last:border-0">
                          {cell.map((b) => (
                            <Block key={b.id} block={b} events={map} filters={filters} activeId={activeId} />
                          ))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <Fragment key={node.id}>
            <Block block={node} events={map} filters={filters} activeId={activeId} />
          </Fragment>
        );
      })}
    </article>
  );
}
