import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

type Token = { text: string; cls: string };

const KEYWORDS = /^(import|from|const|new|return|export|await|async)$/;

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  const re = /('[^']*'|`[^`]*`|"[^"]*"|\/\/.*$|[A-Za-z_$][\w$]*|\s+|.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const t = m[0];
    let cls = "text-slate-200";
    if (t.startsWith("//")) cls = "text-slate-500 italic";
    else if (/^['"`]/.test(t)) cls = "text-emerald-300";
    else if (KEYWORDS.test(t)) cls = "text-sky-300";
    else if (/^[A-Z]/.test(t)) cls = "text-indigo-300";
    else if (/^[{}()[\];,.:]$/.test(t)) cls = "text-slate-500";
    else cls = "text-slate-200";
    tokens.push({ text: t, cls });
  }
  return tokens;
}

export function CodePanel({
  code,
  label,
  filename,
}: {
  code: string;
  label: string;
  filename?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  const lines = code.split("\n");

  return (
    <figure className="overflow-hidden rounded-xl border border-navy/15 bg-navy shadow-panel">
      <figcaption className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <span className="font-mono text-[0.6875rem] tracking-[0.12em] text-primary-foreground/60 uppercase">
          {label}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Code copied to clipboard" : "Copy code to clipboard"}
          className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1 font-mono text-xs text-primary-foreground/80 transition-colors hover:border-white/35 hover:text-primary-foreground"
        >
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>
      {filename ? (
        <div className="border-b border-white/5 px-4 py-2 font-mono text-xs text-primary-foreground/40">
          {filename}
        </div>
      ) : null}
      <div className="overflow-x-auto px-2 py-4 sm:px-4">
        <pre className="font-mono text-[0.8125rem] leading-6">
          <code>
            {lines.map((line, i) => (
              <div key={i} className="grid w-max min-w-full grid-cols-[2ch_max-content] gap-4 px-2">
                <span aria-hidden className="text-right text-white/20 select-none">
                  {i + 1}
                </span>
                <span className="whitespace-pre">
                  {tokenizeLine(line).map((t, j) => (
                    <span key={j} className={t.cls}>
                      {t.text}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
      <p aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </p>
    </figure>
  );
}

