import { useState } from "react";
import { Copy, Download } from "lucide-react";
import type { DocxAnalysis, EditEvent, MediaPart } from "@/lib/docx/types";
import { buildReport } from "@/lib/docx/report";
import { MetadataPanel } from "./MetadataPanel";
import { cn } from "@/lib/utils";

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border pb-5">
      <span className="label-micro">{title}</span>
      {note && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="break-words text-right text-xs text-foreground">{value}</span>
    </div>
  );
}

function TextButton({
  onClick,
  children,
  className,
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const stem = (fileName: string) => fileName.replace(/\.docx?$|\.docm$/i, "") || "document";

function commentText(events: EditEvent[]) {
  return events
    .map((c) => `${c.author}${c.date ? ` (${new Date(c.date).toLocaleString()})` : ""}: ${c.text}`)
    .join("\n");
}

/**
 * Right rail: what this specific file actually carries, with the plain values
 * and short explanations. Nothing is scored or inferred, and empty categories
 * are simply left out.
 */
export function FindingsPanel({
  analysis,
  file,
  source,
  activeId,
  onSelect,
}: {
  analysis: DocxAnalysis;
  file: File;
  source?: string | undefined;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {

  const { meta, events, customProperties, hyperlinks, media, people } = analysis;
  const comments = events.filter((e) => e.type === "comment");
  const deletions = events.filter((e) => e.type === "deletion");
  const [copied, setCopied] = useState("");

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("copy blocked");
    }
  };

  const downloadImage = (m: MediaPart, index: number) => {
    const ext = m.path.split(".").pop() ?? "bin";
    save(m.blob, `${stem(meta.fileName)}-image-${index + 1}.${ext}`);
  };

  const names = [
    meta.creator && ["Created by", meta.creator],
    meta.lastModifiedBy && ["Last edited by", meta.lastModifiedBy],
    meta.company && ["Company", meta.company],
    meta.manager && ["Manager", meta.manager],
  ].filter(Boolean) as [string, string][];
  const revisionAuthors = Array.from(new Set(events.map((e) => e.author)));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-6 pt-5 font-sans">


        <div>
          <span className="label-micro">In this file</span>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Everything below was read from the file on this device, and the file itself was not
            changed. Nothing is uploaded to a server.
          </p>
        </div>

        {events.length === 0 && (
          <p className="border-b border-border pb-5 text-xs leading-relaxed text-foreground">
            No retained comments or tracked changes were found in this file. That does not prove no
            editing took place — comments and tracked changes are only kept while they exist in the
            document, and accepted or deleted ones leave nothing behind.
          </p>
        )}

        {comments.length > 0 && (
          <Section
            title={`Comments (${comments.length})`}
            note="Comment text travels with the file and is readable by anyone you send it to."
          >
            <div className="flex flex-col gap-2">
              {comments.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    "py-0.5 text-left text-xs",
                    activeId === c.id && "text-foreground",
                  )}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="truncate font-medium text-foreground">{c.author}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {c.date ? new Date(c.date).toLocaleDateString() : "no timestamp"}
                    </span>
                  </span>
                  <span className="mt-0.5 block leading-relaxed text-muted-foreground">{c.text}</span>
                </button>
              ))}
            </div>
            <TextButton onClick={() => copy(commentText(comments), "comments")} className="mt-1.5">
              <Copy className="size-3" /> {copied === "comments" ? "Copied" : "Copy comments"}
            </TextButton>
          </Section>
        )}

        {deletions.length > 0 && (
          <Section
            title={`Deleted text still in the file (${deletions.length})`}
            note="Removed wording stays recorded until the changes are accepted."
          >
            <div className="flex flex-col gap-2">
              {deletions.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelect(d.id)}
                  className="py-0.5 text-left text-xs leading-relaxed text-muted-foreground"
                >
                  <span className="font-medium text-foreground">{d.author}</span> · {d.text}
                </button>
              ))}
            </div>
          </Section>
        )}

        {(names.length > 0 || people.length > 0 || revisionAuthors.length > 0) && (
          <Section title="Names and organisation" note="Stored inside the file, not just in its content.">
            {names.map(([label, value]) => (
              <Row key={label} label={label} value={value} />
            ))}
            {revisionAuthors.length > 0 && (
              <Row label="Named in edits" value={revisionAuthors.join(", ")} />
            )}
            {people.map((p) => (
              <Row key={p} label="Identity" value={p} />
            ))}
          </Section>
        )}

        {hyperlinks.length > 0 && (
          <Section
            title={`Links and references (${hyperlinks.length})`}
            note="Shown as stored. Nothing is opened or contacted."
          >
            <ul className="space-y-1">
              {hyperlinks.map((h) => (
                <li key={h.target} className="break-all text-xs text-muted-foreground">
                  {h.target}
                  {h.external && <span className="ml-1 text-foreground/60">external</span>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {customProperties.length > 0 && (
          <Section
            title={`Custom properties (${customProperties.length})`}
            note="Fields added by Word templates or document systems."
          >
            {customProperties.map((p) => (
              <Row key={p.name} label={p.name} value={p.value} />
            ))}
          </Section>
        )}

        {media.length > 0 && (
          <Section
            title={`Embedded files (${media.length})`}
            note="Stored inside the package. Saving a copy keeps the original untouched."
          >
            <div className="flex flex-col">
              {media.map((m, i) => (
                <div
                  key={m.path}
                  className="flex items-center gap-2 py-1 text-xs"
                >
                  <span className="flex-1 truncate text-muted-foreground">
                    {m.path.replace("word/media/", "")}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {Math.max(1, Math.round(m.bytes / 1024))} KB
                  </span>
                  <TextButton onClick={() => downloadImage(m, i)}>
                    <Download className="size-3" /> Save
                  </TextButton>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section
          title="Created and modified"
          note="These values can be edited or removed, so they are not proof of who made the file or when."
        >
          <Row label="Created" value={meta.created} />
          <Row label="Modified" value={meta.modified} />
          <Row label="Last printed" value={meta.lastPrinted} />
          <Row label="Revision counter" value={meta.revision} />
          <Row label="Application" value={meta.application} />
          <Row
            label="Editing time"
            value={meta.totalEditTimeMinutes != null ? `${meta.totalEditTimeMinutes} min` : null}
          />
        </Section>

        <details className="border-b border-border pb-3">
          <summary className="cursor-pointer list-none py-2">
            <span className="label-micro">All stored properties</span>
          </summary>
          <div className="pt-1">
            <MetadataPanel analysis={analysis} />
          </div>
        </details>

        <TextButton
          onClick={() =>
            save(
              new Blob([buildReport(analysis)], { type: "text/plain;charset=utf-8" }),
              `${stem(meta.fileName)}-findings.txt`,
            )
          }
        >
          <Download className="size-3" /> Export findings report
        </TextButton>
      </div>

    </div>

  );
}
