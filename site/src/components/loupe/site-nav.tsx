import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { DEMO_URL, SECTIONS } from "./site-data";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display text-[1.0625rem] font-semibold tracking-[-0.04em] ${className}`}
    >
      Loupe
      <span className="ml-1.5 align-middle font-mono text-[0.625rem] font-normal tracking-[0.16em] text-muted-foreground uppercase">
        for developers
      </span>
    </span>
  );
}

function useActiveSection() {
  const [active, setActive] = useState<string>("overview");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);
  return active;
}

export function DocsSidebar() {
  const active = useActiveSection();
  return (
    <nav aria-label="Page sections" className="sticky top-24 hidden lg:block">
      <p className="eyebrow mb-4">On this page</p>
      <ul className="space-y-0.5 border-l border-border">
        {SECTIONS.map((s) => {
          const isActive = active === s.id;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={isActive ? "true" : undefined}
                className={`focus-ring -ml-px block border-l py-1.5 pl-4 text-sm transition-colors ${
                  isActive
                    ? "border-cobalt font-medium text-cobalt"
                    : "border-transparent text-muted-foreground hover:border-navy/25 hover:text-foreground"
                }`}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <a href="#top" className="focus-ring">
          <Wordmark />
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="focus-ring text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {s.label}
            </a>
          ))}
          <a
            href={DEMO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="focus-ring inline-flex items-center gap-1 rounded-md bg-cobalt px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            DOCX demo
            <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          className="focus-ring inline-flex size-9 items-center justify-center rounded-md border border-border text-foreground md:hidden"
        >
          {open ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
        </button>
      </div>

      {open ? (
        <div id="mobile-nav" className="border-t border-border bg-background md:hidden">
          <nav aria-label="Mobile" className="mx-auto max-w-6xl px-5 py-3 sm:px-8">
            <ul className="divide-y divide-border">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={() => setOpen(false)}
                    className="focus-ring block py-3 text-sm text-foreground"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
            <a
              href={DEMO_URL}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => setOpen(false)}
              className="focus-ring mt-4 inline-flex w-full items-center justify-center gap-1 rounded-md bg-cobalt px-4 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Try the DOCX demo
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

