import type { DocxAnalysis } from "@/lib/docx/types";

function Row({ label, value }: { label: string; value: string }) {
  if (value === "—") return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="break-words text-right text-xs text-foreground">{value}</span>
    </div>
  );
}

/** Collapsible group so the long technical lists stay out of the way. */
function Group({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <details className="border-b border-border pb-3 last:border-0">
      <summary className="flex cursor-pointer list-none items-baseline justify-between py-2">
        <span className="label-micro">{title}</span>
        {count !== undefined && (
          <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
        )}
      </summary>
      <div className="pt-1">{children}</div>
    </details>
  );
}

const dash = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : String(v);

/** Right rail: every property stored in the file's package. */
export function MetadataPanel({ analysis }: { analysis: DocxAnalysis }) {
  const {
    meta,
    sessions,
    customProperties,
    settingsFlags,
    hyperlinks,
    media,
    parts,
    fonts,
    people,
    rawTrackedTags,
  } = analysis;
  const kb = Math.max(1, Math.round(meta.fileSize / 1024));

  return (
    <div className="space-y-5 font-sans">
      <div>
        <span className="label-micro">Stored in the file</span>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          These values can be edited or removed. They do not verify who created the file or when.
        </p>
      </div>

      <div>
        <Row label="Title" value={dash(meta.title)} />
        <Row label="Subject" value={dash(meta.subject)} />
        <Row label="Description" value={dash(meta.description)} />
        <Row label="Keywords" value={dash(meta.keywords)} />
        <Row label="Category" value={dash(meta.category)} />
        <Row label="Status" value={dash(meta.contentStatus)} />
        <Row label="Language" value={dash(meta.language)} />
        <Row label="Created by" value={dash(meta.creator)} />
        <Row label="Last edited by" value={dash(meta.lastModifiedBy)} />
        <Row label="Created" value={dash(meta.created)} />
        <Row label="Modified" value={dash(meta.modified)} />
        <Row label="Last printed" value={dash(meta.lastPrinted)} />
        <Row label="Revision counter" value={dash(meta.revision)} />
        <Row label="Application" value={dash(meta.application)} />
        <Row label="Version" value={dash(meta.appVersion)} />
        <Row label="Company" value={dash(meta.company)} />
        <Row label="Manager" value={dash(meta.manager)} />
        <Row label="Template" value={dash(meta.template)} />
        <Row label="Doc security" value={dash(meta.docSecurity)} />
        <Row
          label="Total editing time"
          value={meta.totalEditTimeMinutes != null ? `${meta.totalEditTimeMinutes} min` : "—"}
        />
        <Row label="Words" value={dash(meta.words)} />
        <Row label="Characters" value={dash(meta.characters)} />
        <Row label="Paragraphs" value={dash(meta.paragraphs)} />
        <Row label="Lines" value={dash(meta.lines)} />
        <Row label="Pages" value={dash(meta.pages)} />
        <Row label="Revision tags in XML" value={String(rawTrackedTags)} />
        <Row label="File size" value={`${kb} KB`} />
      </div>

      {customProperties.length > 0 && (
        <Group title="Custom properties" count={customProperties.length}>
          {customProperties.map((p) => (
            <Row key={p.name} label={p.name} value={p.value} />
          ))}
        </Group>
      )}

      {settingsFlags.length > 0 && (
        <Group title="Settings" count={settingsFlags.length}>
          {settingsFlags.map((p) => (
            <Row key={p.name} label={p.name} value={p.value} />
          ))}
        </Group>
      )}

      <Group title="Revision IDs" count={sessions.length}>
        {sessions.map((s) => (
          <Row
            key={s.rsid}
            label={s.rsid.toLowerCase()}
            value={s.runCount ? `${s.runCount} runs` : "—"}
          />
        ))}
        {sessions.length === 0 && <span className="text-xs text-muted-foreground">None recorded</span>}
      </Group>

      {people.length > 0 && (
        <Group title="Identities in file" count={people.length}>
          <ul className="space-y-1 text-xs break-all text-muted-foreground">
            {people.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Group>
      )}

      {hyperlinks.length > 0 && (
        <Group title="Links & external refs" count={hyperlinks.length}>
          <ul className="space-y-1">
            {hyperlinks.map((h) => (
              <li key={h.target} className="break-all text-xs text-muted-foreground">
                {h.target}
              </li>
            ))}
          </ul>
        </Group>
      )}

      {fonts.length > 0 && (
        <Group title="Fonts" count={fonts.length}>
          <p className="text-xs leading-relaxed text-muted-foreground">{fonts.join(", ")}</p>
        </Group>
      )}

      {media.length > 0 && (
        <Group title="Embedded media" count={media.length}>
          {media.map((m) => (
            <Row
              key={m.path}
              label={m.path.replace("word/media/", "")}
              value={`${Math.max(1, Math.round(m.bytes / 1024))} KB`}
            />
          ))}
        </Group>
      )}

      <Group title="Package contents" count={parts.length}>
        <ul className="space-y-0.5">
          {parts.map((p) => (
            <li key={p.path} className="break-all font-mono text-xs text-muted-foreground">
              {p.path}
            </li>
          ))}
        </ul>
      </Group>
    </div>
  );
}
