export type EditType = "insertion" | "deletion" | "comment";

export interface EditEvent {
  sourcePart?: string;
  id: string;
  type: EditType;
  author: string;
  date: string | null;
  text: string;
  rsid: string | null;
  /** 1-based marker number for comments */
  marker?: number | undefined;
}

export interface DocRun {
  text: string;
  bold?: boolean | undefined;
  italic?: boolean | undefined;
  underline?: boolean | undefined;
  change?: "ins" | "del" | undefined;
  eventId?: string | undefined;
  commentIds?: string[] | undefined;
  rsid?: string | null;
}

export type BlockType = "p" | "h1" | "h2" | "h3" | "li" | "quote";

export interface DocBlock {
  kind: "block";
  id: string;
  type: BlockType;
  runs: DocRun[];
}

export interface DocTable {
  kind: "table";
  id: string;
  rows: DocBlock[][][]; // rows -> cells -> blocks
}

export type DocNode = DocBlock | DocTable;

export interface RsidSession {
  rsid: string;
  runCount: number;
}

export interface DocxMeta {
  fileName: string;
  fileSize: number;
  title: string | null;
  subject: string | null;
  description: string | null;
  keywords: string | null;
  category: string | null;
  contentStatus: string | null;
  language: string | null;
  creator: string | null;
  lastModifiedBy: string | null;
  revision: string | null;
  created: string | null;
  modified: string | null;
  lastPrinted: string | null;
  application: string | null;
  appVersion: string | null;
  company: string | null;
  manager: string | null;
  template: string | null;
  docSecurity: string | null;
  totalEditTimeMinutes: number | null;
  words: number | null;
  characters: number | null;
  paragraphs: number | null;
  lines: number | null;
  pages: number | null;
}

export interface NameValue {
  name: string;
  value: string;
}

export interface HyperlinkRef {
  target: string;
  external: boolean;
}

export interface PackagePart {
  path: string;
  bytes: number;
}

export interface MediaPart extends PackagePart {
  /** Literal bytes from the package, kept so images can be saved locally. */
  blob: Blob;
}

export interface DocxAnalysis {
  meta: DocxMeta;
  nodes: DocNode[];
  events: EditEvent[];
  sessions: RsidSession[];
  authors: string[];
  /** Raw count of revision tags found in the file's XML, before filtering */
  rawTrackedTags: number;
  customProperties: NameValue[];
  settingsFlags: NameValue[];
  hyperlinks: HyperlinkRef[];
  media: MediaPart[];
  parts: PackagePart[];
  fonts: string[];
  people: string[];
}
