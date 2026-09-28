import type { DocxAnalysis } from "./types";

const line = (label: string, value: string | number | null | undefined) =>
  value === null || value === undefined || value === "" ? null : `${label}: ${value}`;

/**
 * A plain-text record of what was actually found in the package.
 * Nothing here is inferred: every line is a value read from the file, and the
 * limitations section states what a DOCX cannot tell us.
 */
export function buildReport(analysis: DocxAnalysis): string {
  const { meta, events, sessions, customProperties, hyperlinks, media, people, fonts, parts } =
    analysis;
  const out: string[] = [];
  const push = (...rows: (string | null)[]) => {
    for (const r of rows) if (r) out.push(r);
  };

  out.push("FINDINGS REPORT", "");
  push(
    line("Source file", meta.fileName),
    line("File size", `${Math.max(1, Math.round(meta.fileSize / 1024))} KB`),
    line("Report generated", new Date().toISOString()),
  );
  out.push("", "Read locally in the browser. The source file was not modified or uploaded.", "");

  const comments = events.filter((e) => e.type === "comment");
  const deletions = events.filter((e) => e.type === "deletion");
  const insertions = events.filter((e) => e.type === "insertion");

  out.push("SUMMARY");
  push(
    line("Comments stored in the file", comments.length),
    line("Retained deletions", deletions.length),
    line("Retained insertions", insertions.length),
    line("Revision IDs in settings.xml", sessions.length),
    line("Embedded media files", media.length),
    line("External links and references", hyperlinks.length),
    line("Custom properties", customProperties.length),
  );
  if (events.length === 0) out.push("No tracked changes or comments are retained in this file.");
  out.push("");

  if (comments.length) {
    out.push("COMMENTS");
    for (const c of comments) {
      out.push(`- ${c.author}${c.date ? ` (${c.date})` : " (no timestamp)"}: ${c.text}`);
    }
    out.push("");
  }

  if (deletions.length) {
    out.push("DELETED TEXT STILL PRESENT IN THE FILE");
    for (const d of deletions) {
      out.push(`- ${d.author}${d.date ? ` (${d.date})` : " (no timestamp)"}: ${d.text}`);
    }
    out.push("");
  }

  const names = Array.from(
    new Set(
      [
        meta.creator && `Created by: ${meta.creator}`,
        meta.lastModifiedBy && `Last edited by: ${meta.lastModifiedBy}`,
        meta.company && `Company: ${meta.company}`,
        meta.manager && `Manager: ${meta.manager}`,
        ...people.map((p) => `Identity in file: ${p}`),
        ...events.map((e) => `Named in revisions: ${e.author}`),
      ].filter(Boolean) as string[],
    ),
  );
  if (names.length) {
    out.push("NAMES AND ORGANISATION DETAILS", ...names.map((n) => `- ${n}`), "");
  }

  if (hyperlinks.length) {
    out.push("LINKS AND EXTERNAL REFERENCES");
    for (const h of hyperlinks) {
      out.push(`- ${h.target}${h.external ? " (external target)" : ""}`);
    }
    out.push("");
  }

  if (customProperties.length) {
    out.push(
      "CUSTOM PROPERTIES",
      ...customProperties.map((p) => `- ${p.name}: ${p.value}`),
      "",
    );
  }

  if (media.length) {
    out.push(
      "EMBEDDED MEDIA",
      ...media.map((m) => `- ${m.path} (${Math.max(1, Math.round(m.bytes / 1024))} KB)`),
      "",
    );
  }

  out.push("STORED METADATA");
  push(
    line("Title", meta.title),
    line("Subject", meta.subject),
    line("Description", meta.description),
    line("Keywords", meta.keywords),
    line("Category", meta.category),
    line("Status", meta.contentStatus),
    line("Language", meta.language),
    line("Created", meta.created),
    line("Modified", meta.modified),
    line("Last printed", meta.lastPrinted),
    line("Revision counter", meta.revision),
    line("Application", meta.application),
    line("Application version", meta.appVersion),
    line("Template", meta.template),
    line(
      "Total editing time",
      meta.totalEditTimeMinutes != null ? `${meta.totalEditTimeMinutes} min` : null,
    ),
    line("Words", meta.words),
    line("Pages", meta.pages),
    line("Fonts referenced", fonts.length ? fonts.join(", ") : null),
    line("Package parts", parts.length),
  );
  out.push("");

  out.push(
    "LIMITATIONS",
    "- Stored metadata can be edited or removed. It is not proof of who wrote the file or when.",
    "- Word does not keep a keystroke or undo history inside the file.",
    "- Tracked changes only remain while Track Changes was on and before changes were accepted.",
    "- Revision IDs group runs typed in the same editing burst. They carry no dates, authors or order.",
    "- Absence of findings does not mean the file is safe to share.",
    "- This report lists what was read from the package. It contains no authenticity or fraud assessment.",
  );

  return out.join("\n");
}
