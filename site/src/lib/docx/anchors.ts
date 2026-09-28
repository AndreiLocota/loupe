import type { DocNode, DocRun } from "@/lib/docx/types";

function walk(nodes: DocNode[], out: DocRun[]) {
  for (const node of nodes) {
    if (node.kind === "block") out.push(...node.runs);
    else for (const row of node.rows) for (const cell of row) walk(cell, out);
  }
}

/**
 * The longest single run of body text that a Word comment covers. One run,
 * because the DOCX adapter matches text per text node — a phrase spanning a
 * formatting boundary would not be found. Returns null when the comment has no
 * resolvable range; callers must not guess an anchor from the comment text.
 */
export function commentAnchorText(nodes: DocNode[], commentId: string): string | null {
  const runs: DocRun[] = [];
  walk(nodes, runs);
  let best = "";
  for (const run of runs) {
    if (!run.commentIds?.includes(commentId)) continue;
    const text = run.text.trim();
    if (text.length > best.length) best = text;
  }
  return best.length >= 4 ? best : null;
}
