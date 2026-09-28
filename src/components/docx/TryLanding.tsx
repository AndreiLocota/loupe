import { useCallback, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, FileText, Loader2, RotateCw, ShieldCheck, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import bg from "@/assets/upload-bg.jpg.asset.json";
import { SAMPLES, type LandingProps, type SampleKind } from "./DocxExperience";

export function TryLanding({ onFile, onSample, busy, pending, error, failedSample }: LandingProps) {
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    (file: File | undefined | null) => {
      if (!file || busy) return;
      const name = file.name.toLowerCase();
      if (name.endsWith(".doc")) {
        setLocalError("The older .doc format isn't supported. Save it as .docx in Word first.");
        return;
      }
      if (!name.endsWith(".docx") && !name.endsWith(".docm")) {
        setLocalError("That isn't a Word file. Choose a .docx or .docm document.");
        return;
      }
      setLocalError(null);
      onFile(file);
    },
    [onFile, busy],
  );

  const message = localError ?? error;
  const sample = (kind: SampleKind) => {
    setLocalError(null);
    onSample(kind);
  };

  return (
    <div
      className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-navy"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handle(e.dataTransfer.files?.[0]);
      }}
    >
      <img
        src={bg.url}
        alt=""
        aria-hidden="true"
        width={1920}
        height={1200}
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-navy/35 via-navy/10 to-transparent" />

      <header className="relative flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="font-display text-xl font-semibold tracking-[-0.04em] text-primary-foreground drop-shadow-sm">
          Loupe
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-card/85 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur">
          <ShieldCheck className="size-3.5 text-primary" />
          <span className="hidden sm:inline">Processing stays on your device</span>
          <span className="sm:hidden">On-device</span>
        </span>
      </header>

      <main className="relative flex flex-1 items-center px-4 py-6 sm:px-10">
        <div
          className={cn(
            "w-full max-w-[26rem] rounded-2xl bg-card p-6 shadow-lift ring-1 transition-shadow rise-in sm:p-8",
            dragging ? "ring-2 ring-primary" : "ring-border/60",
          )}
        >
          <h1 className="text-[1.75rem] font-semibold leading-[1.1] text-foreground sm:text-[2rem]">
            Look closer at your documents.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Open a Word file to view it page by page, alongside any comments and tracked changes it
            still carries.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".docx,.docm,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-word.document.macroEnabled.12"
            className="sr-only"
            aria-label="Choose a Word document"
            onChange={(e) => {
              handle(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "focus-ring mt-6 flex w-full flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center transition-colors disabled:cursor-wait disabled:opacity-70",
              dragging ? "border-primary bg-accent" : "border-border hover:border-primary hover:bg-accent/60",
            )}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {pending === "file" ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <UploadCloud className="size-5" />
              )}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {pending === "file" ? "Reading the document…" : "Drop a Word file or browse"}
            </span>
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
              DOCX · DOCM only · up to 20 MB
            </span>
          </button>

          {message && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg bg-del-soft p-3 text-left text-sm text-del"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span className="flex-1">{message}</span>
              {failedSample && !localError && (
                <button
                  type="button"
                  onClick={() => sample(failedSample)}
                  disabled={busy}
                  className="focus-ring inline-flex shrink-0 items-center gap-1 font-medium underline-offset-4 hover:underline"
                >
                  <RotateCw className="size-3.5" /> Retry
                </button>
              )}
            </div>
          )}

          <div className="mt-6">
            <p className="text-xs font-medium text-muted-foreground">No file handy? Open a sample:</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(Object.keys(SAMPLES) as SampleKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={busy}
                  onClick={() => sample(k)}
                  className="focus-ring flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-accent/60 disabled:cursor-wait disabled:opacity-60"
                >
                  {pending === k ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                  ) : (
                    <FileText className="size-4 shrink-0 text-primary" />
                  )}
                  <span className="truncate">{pending === k ? "Loading…" : SAMPLES[k].label}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Read in your browser, never uploaded. Shows only what the file still retains — not a
            complete edit history. Your file is never modified.
          </p>
        </div>
      </main>

      <footer className="relative px-6 pb-5 sm:px-10">
        <Link
          to="/"
          className="focus-ring text-sm font-semibold text-navy underline-offset-4 [text-shadow:0_0_6px_var(--card),0_0_2px_var(--card)] hover:underline"
        >
          Loupe for Developers / API docs →
        </Link>
      </footer>
    </div>
  );
}
