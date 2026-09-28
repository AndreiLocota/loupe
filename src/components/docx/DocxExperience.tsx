import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnalysisView } from "@/components/docx/AnalysisView";
import type { DocxAnalysis } from "@/lib/docx/types";

export type SampleKind = "nda" | "insurance";

export const SAMPLES: Record<SampleKind, { url: string; name: string; label: string }> = {
  nda: { url: "/sample-nda.docx", name: "Mutual-NDA-draft.docx", label: "Sample contract" },
  insurance: {
    url: "/sample-insurance-claim.docx",
    name: "Sample-insurance-claim-report.docx",
    label: "Insurance claim report",
  },
};

export interface LandingProps {
  onFile: (file: File) => void;
  onSample: (kind: SampleKind) => void;
  busy: boolean;
  /** Which action is currently loading, for per-button feedback. */
  pending: SampleKind | "file" | null;
  error: string | null;
  /** Sample that failed last, so the landing can offer a retry. */
  failedSample: SampleKind | null;
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (/zip|central directory|end of data|signature/i.test(msg)) {
    return "This file couldn't be opened as a Word document. It may be damaged or not really a .docx — try re-saving it from Word.";
  }
  return msg || "Something went wrong reading that file.";
}

/**
 * The one functional DOCX flow: pick or sample a file, parse it locally, then
 * hand the ORIGINAL File to the analysis screen. Nothing leaves the browser.
 */
export function DocxExperience({
  source,
  renderLanding,
}: {
  source: string;
  renderLanding: (props: LandingProps) => ReactNode;
}) {
  const [analysis, setAnalysis] = useState<DocxAnalysis | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState<SampleKind | "file" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedSample, setFailedSample] = useState<SampleKind | null>(null);
  const [dark, setDark] = useState(false);
  const busyRef = useRef(false);

  // Scope the inspector palette (and its dark mode) to /try; always clean up
  // on leave so the developer homepage never inherits `dark`.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("loupe-try-active");
    return () => {
      root.classList.remove("loupe-try-active", "dark");
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const run = useCallback(async (tag: SampleKind | "file", load: () => Promise<File>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPending(tag);
    setError(null);
    setFailedSample(null);
    try {
      let next: File;
      try {
        next = await load();
      } catch {
        if (tag !== "file") {
          setFailedSample(tag);
          setError(`Couldn't load the ${SAMPLES[tag].label.toLowerCase()}. Check your connection and try again.`);
        } else {
          setError("Couldn't read that file.");
        }
        return;
      }
      try {
        const { analyzeDocx } = await import("@/lib/docx/parse");
        const result = await analyzeDocx(next);
        setAnalysis(result);
        setFile(next);
      } catch (e) {
        setError(friendlyError(e));
      }
    } finally {
      busyRef.current = false;
      setPending(null);
    }
  }, []);

  const onFile = useCallback((f: File) => void run("file", async () => f), [run]);

  const onSample = useCallback(
    (kind: SampleKind) =>
      void run(kind, async () => {
        const s = SAMPLES[kind];
        const res = await fetch(s.url);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        return new File([blob], s.name, {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
      }),
    [run],
  );

  if (analysis && file) {
    return (
      <div className="loupe-try">
        <AnalysisView
          analysis={analysis}
          file={file}
          source={source}
          onReset={() => {
            setAnalysis(null);
            setFile(null);
            setError(null);
          }}
          dark={dark}
          onToggleDark={() => setDark((d) => !d)}
        />
      </div>
    );
  }

  return (
    <div className="loupe-try">
      {renderLanding({ onFile, onSample, busy: pending !== null, pending, error, failedSample })}
    </div>
  );
}
