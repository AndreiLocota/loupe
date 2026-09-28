import JSZip from "jszip";
import type {
  DocBlock,
  DocNode,
  DocRun,
  DocTable,
  DocxAnalysis,
  DocxMeta,
  EditEvent,
  HyperlinkRef,
  MediaPart,
  NameValue,
  PackagePart,
  RsidSession,
} from "./types";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Invalid document XML.");
  return doc;
}

function attr(el: Element, name: string): string | null {
  return el.getAttributeNS(W, name) ?? el.getAttribute(`w:${name}`);
}

function childText(root: Document | Element, tag: string): string | null {
  const namespaces: Record<string, string> = {
    dc: "http://purl.org/dc/elements/1.1/",
    cp: "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
    dcterms: "http://purl.org/dc/terms/",
  };
  const [prefix, local] = tag.split(":");
  const el = local
    ? root.getElementsByTagNameNS(namespaces[prefix ?? ""] ?? "", local)[0]
    : root.getElementsByTagNameNS(
        "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties",
        tag,
      )[0];
  return el?.textContent?.trim() || null;
}

function styleToBlockType(style: string | null): DocBlock["type"] {
  if (!style) return "p";
  const s = style.toLowerCase().replace(/\s|-/g, "");
  if (s === "title" || s === "heading1") return "h1";
  if (s === "heading2" || s === "subtitle") return "h2";
  if (s.startsWith("heading")) return "h3";
  if (s.includes("quote")) return "quote";
  if (s.includes("listparagraph")) return "li";
  return "p";
}

interface Ctx {
  events: EditEvent[];
  rsidCounts: Map<string, number>;
  commentAuthors: Map<string, { author: string; date: string | null; text: string }>;
  openComments: Set<string>;
  commentOrder: Map<string, number>;
  seq: number;
  sourcePart: string;
}

function runProps(runEl: Element) {
  const rPr = Array.from(runEl.children).find((c) => c.localName === "rPr");
  if (!rPr) return {};
  const has = (n: string) => {
    const el = Array.from(rPr.children).find((c) => c.localName === n);
    if (!el) return false;
    const v = attr(el, "val");
    return v !== "0" && v !== "false" && v !== "none";
  };
  return { bold: has("b"), italic: has("i"), underline: has("u") };
}

function runText(runEl: Element): string {
  let out = "";
  for (const c of Array.from(runEl.children)) {
    if (c.localName === "t" || c.localName === "delText") out += c.textContent ?? "";
    else if (c.localName === "tab") out += "\t";
    else if (c.localName === "br") out += "\n";
  }
  return out;
}

function collectRuns(
  container: Element,
  ctx: Ctx,
  inherited?: "ins" | "del",
  changeMeta?: { author: string; date: string | null; id: string },
): DocRun[] {
  const runs: DocRun[] = [];
  for (const child of Array.from(container.children)) {
    const name = child.localName;
    if (name === "r") {
      const text = runText(child);
      const rsid =
        attr(child, "rsidR") ??
        attr(child, "rsidRDefault") ??
        attr(container, "rsidR") ??
        attr(container, "rsidRDefault");
      if (rsid) ctx.rsidCounts.set(rsid, (ctx.rsidCounts.get(rsid) ?? 0) + 1);
      if (!text) continue;
      runs.push({
        text,
        ...runProps(child),
        change: inherited,
        eventId: changeMeta?.id,
        commentIds: ctx.openComments.size ? Array.from(ctx.openComments) : undefined,
        rsid,
      });
    } else if (name === "ins" || name === "del" || name === "moveTo" || name === "moveFrom") {
      const kind = name === "ins" || name === "moveTo" ? "ins" : "del";
      const id = `${kind}-${ctx.seq++}`;
      const author = attr(child, "author") || "Unknown";
      const date = attr(child, "date");
      const nested = collectRuns(child, ctx, kind, { author, date, id });
      const text = nested.map((r) => r.text).join("");
      if (text.trim()) {
        ctx.events.push({
          id,
          sourcePart: ctx.sourcePart,
          type: kind === "ins" ? "insertion" : "deletion",
          author,
          date,
          text: text.trim(),
          rsid: nested.find((r) => r.rsid)?.rsid ?? null,
        });
      }
      runs.push(...nested);
    } else if (name === "commentRangeStart") {
      const id = attr(child, "id");
      if (id) ctx.openComments.add(id);
    } else if (name === "commentRangeEnd") {
      const id = attr(child, "id");
      if (id) ctx.openComments.delete(id);
    } else if (
      name === "hyperlink" ||
      name === "smartTag" ||
      name === "sdtContent" ||
      name === "sdt" ||
      name === "bookmarkStart" ||
      name === "moveToRangeStart" ||
      name === "moveFromRangeStart" ||
      name === "customXml"
    ) {
      runs.push(...collectRuns(child, ctx, inherited, changeMeta));
    }
  }
  return runs;
}

function parseParagraph(pEl: Element, ctx: Ctx): DocBlock {
  const pPr = Array.from(pEl.children).find((c) => c.localName === "pPr");
  const styleEl = pPr && Array.from(pPr.children).find((c) => c.localName === "pStyle");
  const numPr = pPr && Array.from(pPr.children).find((c) => c.localName === "numPr");
  let type = styleToBlockType(styleEl ? attr(styleEl, "val") : null);
  if (numPr) type = "li";
  return {
    kind: "block",
    id: `b-${ctx.seq++}`,
    type,
    runs: collectRuns(pEl, ctx),
  };
}

function flattenBlocks(nodes: DocNode[]): DocBlock[] {
  const out: DocBlock[] = [];
  for (const n of nodes) {
    if (n.kind === "block") out.push(n);
    else for (const row of n.rows) for (const cell of row) out.push(...flattenBlocks(cell));
  }
  return out;
}

function parseBody(bodyEl: Element, ctx: Ctx): DocNode[] {
  const nodes: DocNode[] = [];
  for (const child of Array.from(bodyEl.children)) {
    const name = child.localName;
    if (name === "p") {
      nodes.push(parseParagraph(child, ctx));
    } else if (name === "tbl") {
      const table: DocTable = { kind: "table", id: `t-${ctx.seq++}`, rows: [] };
      for (const tr of Array.from(child.children).filter((c) => c.localName === "tr")) {
        const row: DocBlock[][] = [];
        for (const tc of Array.from(tr.children).filter((c) => c.localName === "tc")) {
          row.push(flattenBlocks(parseBody(tc, ctx)));
        }
        table.rows.push(row);
      }
      nodes.push(table);
    } else if (name === "sdt" || name === "sdtContent" || name === "customXml") {
      nodes.push(...parseBody(child, ctx));
    }
  }
  return nodes;
}

function parseComments(xml: string | null, ctx: Ctx) {
  if (!xml) return;
  const doc = parseXml(xml);
  const comments = Array.from(doc.getElementsByTagNameNS(W, "comment"));
  comments.forEach((c, i) => {
    const id = attr(c, "id") ?? String(i);
    const author = attr(c, "author") || "Unknown";
    const date = attr(c, "date");
    const text = (c.textContent ?? "").replace(/\s+/g, " ").trim();
    ctx.commentAuthors.set(id, { author, date, text });
    ctx.commentOrder.set(id, i + 1);
    ctx.events.push({
      id: `c-${id}`,
      sourcePart: "word/comments.xml",
      type: "comment",
      author,
      date,
      text,
      rsid: null,
      marker: i + 1,
    });
  });
}

function parseMeta(core: string | null, app: string | null, file: File): DocxMeta {
  const c = core ? parseXml(core) : null;
  const a = app ? parseXml(app) : null;
  const num = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);
  return {
    fileName: file.name,
    fileSize: file.size,
    title: c ? childText(c, "dc:title") : null,
    subject: c ? childText(c, "dc:subject") : null,
    description: c ? childText(c, "dc:description") : null,
    keywords: c ? childText(c, "cp:keywords") : null,
    category: c ? childText(c, "cp:category") : null,
    contentStatus: c ? childText(c, "cp:contentStatus") : null,
    language: c ? childText(c, "dc:language") : null,
    creator: c ? childText(c, "dc:creator") : null,
    lastModifiedBy: c ? childText(c, "cp:lastModifiedBy") : null,
    revision: c ? childText(c, "cp:revision") : null,
    created: c ? childText(c, "dcterms:created") : null,
    modified: c ? childText(c, "dcterms:modified") : null,
    lastPrinted: c ? childText(c, "cp:lastPrinted") : null,
    application: a ? childText(a, "Application") : null,
    appVersion: a ? childText(a, "AppVersion") : null,
    company: a ? childText(a, "Company") : null,
    manager: a ? childText(a, "Manager") : null,
    template: a ? childText(a, "Template") : null,
    docSecurity: a ? childText(a, "DocSecurity") : null,
    totalEditTimeMinutes: a ? num(childText(a, "TotalTime")) : null,
    words: a ? num(childText(a, "Words")) : null,
    characters: a ? num(childText(a, "Characters")) : null,
    paragraphs: a ? num(childText(a, "Paragraphs")) : null,
    lines: a ? num(childText(a, "Lines")) : null,
    pages: a ? num(childText(a, "Pages")) : null,
  };
}

export async function analyzeDocx(file: File): Promise<DocxAnalysis> {
  if (file.size > 20 * 1024 * 1024) throw new Error("Choose a Word file smaller than 20 MB.");
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new Error(
      "This file could not be opened. It may be corrupted, encrypted, or not a real .docx file.",
    );
  }

  const entries = Object.values(zip.files);
  if (entries.length > 10000) throw new Error("Document contains too many package parts.");
  let expanded = 0;
  for (const entry of entries) {
    if (entry.dir) continue;
    const data = (
      entry as unknown as { _data?: { uncompressedSize?: number; compressedSize?: number } }
    )._data;
    if (!data || data.uncompressedSize === undefined || data.compressedSize === undefined)
      throw new Error("Cannot verify document package size.");
    expanded += data.uncompressedSize;
    if (
      data.uncompressedSize > 20 * 1024 * 1024 ||
      expanded > 50 * 1024 * 1024 ||
      (data.uncompressedSize > 0 &&
        (data.compressedSize === 0 || data.uncompressedSize / data.compressedSize > 100))
    )
      throw new Error("Document expands beyond the safe processing limit.");
  }
  const read = async (path: string) => {
    const entry = zip.file(path);
    return entry ? await entry.async("string") : null;
  };

  const documentXml = await read("word/document.xml");
  if (!documentXml) {
    throw new Error(
      "No Word document part found inside this file. Password-protected files can't be analyzed.",
    );
  }

  const [commentsXml, settingsXml, coreXml, appXml] = await Promise.all([
    read("word/comments.xml"),
    read("word/settings.xml"),
    read("docProps/core.xml"),
    read("docProps/app.xml"),
  ]);

  const ctx: Ctx = {
    events: [],
    rsidCounts: new Map(),
    commentAuthors: new Map(),
    openComments: new Set(),
    commentOrder: new Map(),
    seq: 0,
    sourcePart: "word/document.xml",
  };

  parseComments(commentsXml, ctx);

  const doc = parseXml(documentXml);
  const body = doc.getElementsByTagNameNS(W, "body")[0] ?? doc.getElementsByTagName("body")[0];
  if (!body) throw new Error("This document's body could not be read.");
  const nodes = parseBody(body, ctx);

  // Tracked changes can also live in headers, footers, footnotes and endnotes.
  const extraParts = Object.keys(zip.files).filter((p) =>
    /^word\/(header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(p),
  );
  for (const part of extraParts) {
    const xml = await read(part);
    if (!xml) continue;
    try {
      ctx.sourcePart = part;
      const partDoc = parseXml(xml);
      for (const p of Array.from(partDoc.getElementsByTagNameNS(W, "p"))) {
        parseParagraph(p, ctx); // events only; not rendered
      }
    } catch {
      /* ignore unreadable part */
    }
  }

  // Raw diagnostic: does the file contain any revision markup at all?
  let rawTrackedTags = 0;
  for (const part of ["word/document.xml", ...extraParts]) {
    const xml = await read(part);
    if (!xml) continue;
    try {
      const partDoc = parseXml(xml);
      for (const tag of ["ins", "del", "moveTo", "moveFrom"])
        rawTrackedTags += partDoc.getElementsByTagNameNS(W, tag).length;
    } catch {
      /* Unreadable optional parts are not counted. */
    }
  }

  // RSID sessions declared in settings, enriched with observed run counts
  const declared = new Set<string>();
  if (settingsXml) {
    const s = parseXml(settingsXml);
    for (const el of Array.from(s.getElementsByTagNameNS(W, "rsid"))) {
      const v = attr(el, "val");
      if (v) declared.add(v.toUpperCase());
    }
  }
  for (const k of ctx.rsidCounts.keys()) declared.add(k.toUpperCase());
  const sessions: RsidSession[] = Array.from(declared)
    .map((rsid) => ({
      rsid,
      runCount: ctx.rsidCounts.get(rsid) ?? ctx.rsidCounts.get(rsid.toLowerCase()) ?? 0,
    }))
    .sort((a, b) => b.runCount - a.runCount);

  const events = ctx.events.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });

  const meta = parseMeta(coreXml, appXml, file);

  // Custom document properties
  const customProperties: NameValue[] = [];
  const customXml = await read("docProps/custom.xml");
  if (customXml) {
    try {
      const cd = parseXml(customXml);
      for (const p of Array.from(cd.getElementsByTagName("property"))) {
        const name = p.getAttribute("name");
        const value = (p.textContent ?? "").trim();
        if (name) customProperties.push({ name, value: value || "—" });
      }
    } catch {
      /* ignore */
    }
  }

  // Settings flags worth surfacing
  const settingsFlags: NameValue[] = [];
  if (settingsXml) {
    try {
      const s = parseXml(settingsXml);
      const rsidRoot = s.getElementsByTagNameNS(W, "rsidRoot")[0];
      if (rsidRoot)
        settingsFlags.push({
          name: "Root revision ID (rsidRoot)",
          value: (attr(rsidRoot, "val") ?? "—").toLowerCase(),
        });
      const flagTags = [
        ["w:trackRevisions", "Track changes setting"],
        ["w:documentProtection", "Document protection"],
        ["w:removePersonalInformation", "Personal info removal"],
        ["w:removeDateAndTime", "Dates stripped"],
        ["w:writeProtection", "Write protection"],
        ["w:proofState", "Proofing state"],
        ["w:defaultTabStop", "Default tab stop"],
        ["w:zoom", "Saved zoom"],
        ["w:attachedTemplate", "Attached template"],
      ] as const;
      for (const [tag, label] of flagTags) {
        const el = s.getElementsByTagNameNS(W, tag.slice(2))[0];
        if (!el) continue;
        const val = attr(el, "val") ?? el.getAttribute("r:id") ?? "yes";
        settingsFlags.push({ name: label, value: val });
      }
    } catch {
      /* ignore */
    }
  }

  // Hyperlink targets stored in relationships (can leak local paths)
  const hyperlinks: HyperlinkRef[] = [];
  const relPaths = Object.keys(zip.files).filter((p) => /_rels\/.+\.rels$/.test(p));
  const seenTargets = new Set<string>();
  for (const rp of relPaths) {
    const xml = await read(rp);
    if (!xml) continue;
    try {
      const rd = parseXml(xml);
      for (const r of Array.from(rd.getElementsByTagName("Relationship"))) {
        const type = r.getAttribute("Type") ?? "";
        const target = r.getAttribute("Target") ?? "";
        if (!target) continue;
        if (!/hyperlink|attachedTemplate|frame|oleObject|externalLink/i.test(type)) continue;
        if (seenTargets.has(target)) continue;
        seenTargets.add(target);
        hyperlinks.push({ target, external: r.getAttribute("TargetMode") === "External" });
      }
    } catch {
      /* ignore */
    }
  }

  // Package inventory
  const parts: PackagePart[] = [];
  const media: MediaPart[] = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bytes = ((entry as any)._data?.uncompressedSize as number) ?? 0;
    const item = { path, bytes };
    parts.push(item);
    if (/^word\/media\//.test(path)) {
      // Keep the literal bytes so the user can save an embedded file locally.
      // Nothing is decoded, executed or sent anywhere.
      const blob = await entry.async("blob");
      media.push({ ...item, blob, bytes: bytes || blob.size });
    }
  }
  parts.sort((a, b) => a.path.localeCompare(b.path));

  // Fonts referenced by the document
  const fonts: string[] = [];
  const fontTableXml = await read("word/fontTable.xml");
  if (fontTableXml) {
    try {
      const fd = parseXml(fontTableXml);
      for (const f of Array.from(fd.getElementsByTagNameNS(W, "font"))) {
        const n = attr(f, "name");
        if (n && !fonts.includes(n)) fonts.push(n);
      }
    } catch {
      /* ignore */
    }
  }

  // Identities stored in people.xml (comment authors with provider ids)
  const people: string[] = [];
  const peopleXml = await read("word/people.xml");
  if (peopleXml) {
    try {
      const pd = parseXml(peopleXml);
      for (const p of Array.from(pd.getElementsByTagName("w15:person"))) {
        const n = p.getAttribute("w15:author");
        const pres = p.getElementsByTagName("w15:presenceInfo")[0];
        const id = pres?.getAttribute("w15:userId");
        if (n) people.push(id ? `${n} · ${id}` : n);
      }
    } catch {
      /* ignore */
    }
  }

  const authors = Array.from(
    new Set(
      [...events.map((e) => e.author), meta.creator, meta.lastModifiedBy].filter(
        Boolean,
      ) as string[],
    ),
  );

  return {
    meta,
    nodes,
    events,
    sessions,
    authors,
    rawTrackedTags,
    customProperties,
    settingsFlags,
    hyperlinks,
    media,
    parts,
    fonts,
    people,
  };
}
