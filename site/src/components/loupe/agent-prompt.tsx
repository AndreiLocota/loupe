import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import {
  EVALUATION_LICENSE_PATH,
  LICENSE_SUMMARY,
  PACKAGE_INSTALL_COMMAND,
  PACKAGE_NAME,
  PACKAGE_README_PATH,
  SITE_ORIGIN,
} from "@/lib/release";

const AGENT_PROMPT = {
  task: "Add Loupe document viewing to this app for evaluation.",
  install: PACKAGE_INSTALL_COMMAND,
  docs: `${SITE_ORIGIN}/developers`,
  package_readme: `${SITE_ORIGIN}${PACKAGE_README_PATH}`,
  requirements: [
    "Inspect this app and follow its framework, package manager and UI conventions.",
    `Use ${PACKAGE_NAME} with /pdf, /docx and /image adapters; use /react only if this app uses React. Read the linked documentation for the actual API.`,
    "Add local file selection and a viewer with a definite height, loading and error states, and page/zoom controls where supported. Process documents in the browser; no hosted API or API key is required.",
    "Load adapters only in browser code in SSR apps. Ensure workers/WASM resolve, clean up the viewer on unmount, and verify a production build and real document rendering.",
  ],
  licence: LICENSE_SUMMARY,
  licence_text: `${SITE_ORIGIN}${EVALUATION_LICENSE_PATH}`,
};

export const AGENT_PROMPT_JSON = JSON.stringify(AGENT_PROMPT, null, 2);

type Status = "idle" | "copied" | "failed";

export function AgentPrompt() {
  const [status, setStatus] = useState<Status>("idle");
  const ref = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  async function copy() {
    if (timer.current) clearTimeout(timer.current);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("unavailable");
      await navigator.clipboard.writeText(AGENT_PROMPT_JSON);
      setStatus("copied");
      timer.current = setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("failed");
      ref.current?.focus();
      ref.current?.select();
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-navy/15 bg-navy shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <label
          htmlFor="agent-prompt"
          className="font-mono text-[0.6875rem] tracking-[0.12em] text-primary-foreground/60 uppercase"
        >
          Agent prompt (JSON)
        </label>
        <button
          type="button"
          onClick={copy}
          className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1 font-mono text-xs text-primary-foreground/80 transition-colors hover:border-white/35 hover:text-primary-foreground"
        >
          {status === "copied" ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {status === "copied" ? "Copied" : "Copy prompt"}
        </button>
      </div>
      <textarea
        id="agent-prompt"
        ref={ref}
        readOnly
        rows={14}
        value={AGENT_PROMPT_JSON}
        spellCheck={false}
        aria-describedby="agent-prompt-status"
        onFocus={(e) => e.currentTarget.select()}
        className="focus-ring block w-full resize-none overflow-y-auto bg-transparent px-4 py-4 font-mono text-[0.8125rem] leading-6 break-words whitespace-pre-wrap text-primary-foreground/90 outline-none"
      />
      <p
        id="agent-prompt-status"
        role="status"
        aria-live="polite"
        className={status === "failed" ? "border-t border-white/10 px-4 py-2 text-xs text-primary-foreground/80" : "sr-only"}
      >
        {status === "copied"
          ? "Prompt copied to clipboard."
          : status === "failed"
            ? "Couldn't copy automatically. The text is selected — press Ctrl+C (⌘C on Mac) to copy."
            : ""}
      </p>
    </div>
  );
}
