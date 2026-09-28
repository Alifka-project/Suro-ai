import Image from "next/image";
import { Fragment } from "react";
import type {
  AgreementDocument,
  Block,
  BulletItem,
  DocPart,
  Paragraph,
  SignatureParty,
} from "@/lib/admin/agreement-document";
import { BUSINESS } from "@/lib/admin/business";
import { cn } from "@/components/admin/ui";

/*
 * The Service Agreement and its Statement of Work as printable A4 sheets.
 * Renders the same document model as the .docx download
 * (@/lib/admin/agreement-document), so screen, paper and Word always say the
 * same thing. Server-rendered; the admin panels around it are print:hidden.
 *
 * Printing follows billing-document.tsx: a zero page margin keeps the
 * browser's own header and footer (title, date, the admin URL) off the
 * client's copy, and each sheet supplies the margin instead, repeated on every
 * printed page by box-decoration-break: clone. The SOW starts on a new page.
 */
const PRINT_PAGE_CSS = "@page { margin: 0; }";

const LABEL = "font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink-500";

const BRAND_RULE =
  "bg-[linear-gradient(90deg,var(--color-abyss-600),var(--color-azure-500)_30%,var(--color-aqua-500)_55%,var(--color-lilac-400)_80%,var(--color-blush-500))]";

/** Body copy: left-aligned on narrow screens, justified where lines are long enough. */
const BODY = "text-[0.86rem] leading-[1.7] text-ink-800 sm:text-justify print:text-justify print:text-[10.5pt]";

function Runs({ runs }: { runs: Paragraph }) {
  return (
    <>
      {runs.map((run, i) => {
        if (run.placeholder) {
          // A gap still to fill in the draft: amber on screen and on paper, never easy to miss.
          return (
            <mark
              key={i}
              className="rounded bg-amber-400/25 px-1 py-px italic text-amber-800 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
            >
              {run.text}
            </mark>
          );
        }
        return run.bold ? (
          <strong key={i} className="font-semibold text-ink-900">
            {run.text}
          </strong>
        ) : (
          <Fragment key={i}>{run.text}</Fragment>
        );
      })}
    </>
  );
}

/** Level-1 bullets nest under the level-0 bullet before them. */
function nestBullets(items: BulletItem[]): { runs: Paragraph; children: Paragraph[] }[] {
  const out: { runs: Paragraph; children: Paragraph[] }[] = [];
  for (const item of items) {
    const parent = out[out.length - 1];
    if (item.level === 1 && parent) parent.children.push(item.runs);
    else out.push({ runs: item.runs, children: [] });
  }
  return out;
}

function Signatures({ parties }: { parties: SignatureParty[] }) {
  const line = (label: string, value?: string) => (
    <div className="flex items-end gap-2 pt-5 text-[0.8rem]">
      <span className="shrink-0 text-ink-500">{label}:</span>
      <span className="min-w-0 flex-1 break-words border-b border-ink-300 pb-0.5 text-ink-900">{value ?? "\u00a0"}</span>
    </div>
  );
  return (
    <div className="grid gap-8 sm:grid-cols-2 print:grid-cols-2 print:break-inside-avoid">
      {parties.map((party) => (
        <div key={party.role} className="min-w-0">
          <p className="font-display text-[0.9rem] font-bold text-ink-900">{party.role}</p>
          <p className="break-words text-[0.8rem] text-ink-600">{party.organisation}</p>
          {line("Signature")}
          {line("Print name", party.printName)}
          {line("Date")}
        </div>
      ))}
    </div>
  );
}

function DocBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case "paragraph":
      return (
        <p className={cn(BODY, "wrap-break-word")}>
          <Runs runs={block.runs} />
        </p>
      );
    case "bullets":
      return (
        <ul className={cn(BODY, "list-disc space-y-1.5 pl-5 marker:text-ink-400")}>
          {nestBullets(block.items).map((item, i) => (
            <li key={i} className="wrap-break-word pl-1">
              <Runs runs={item.runs} />
              {item.children.length > 0 && (
                <ul className="mt-1.5 list-[circle] space-y-1 pl-5">
                  {item.children.map((child, j) => (
                    <li key={j} className="pl-1">
                      <Runs runs={child} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      );
    case "details":
      return (
        <table className="w-full border-collapse text-left text-[0.84rem] print:text-[10pt]">
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.label} className="align-top">
                <th
                  scope="row"
                  className="w-[34%] border border-ink-200 bg-haze px-3 py-2 font-semibold text-ink-900 sm:w-[28%]"
                >
                  {row.label}
                </th>
                {/* overflow-wrap: anywhere also lowers the cell's minimum width, so a
                    long URL wraps instead of widening the table past the sheet. */}
                <td className="wrap-anywhere border border-ink-200 px-3 py-2 text-ink-800">
                  <Runs runs={row.value} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "table":
      return (
        <table className="w-full border-collapse text-left text-[0.84rem] print:text-[10pt]">
          <thead>
            <tr>
              {block.head.map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={cn(
                    "border border-ink-200 bg-haze px-3 py-2 font-semibold text-ink-900",
                    i === 1 && "w-[38%] sm:w-[30%]",
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map(([milestone, date], i) => (
              <tr key={i} className="align-top print:break-inside-avoid">
                <td className="wrap-anywhere border border-ink-200 px-3 py-2 text-ink-800">{milestone}</td>
                <td
                  className={cn(
                    "border border-ink-200 px-3 py-2 tabular-nums",
                    date === "To be confirmed" ? "italic text-ink-500" : "text-ink-800",
                  )}
                >
                  {date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "signatures":
      return <Signatures parties={block.parties} />;
  }
}

function Sheet({
  part,
  dateLabel,
  id,
  stamp,
  className,
}: {
  part: DocPart;
  dateLabel: string;
  id: string;
  stamp?: string | null;
  className?: string;
}) {
  const titleId = `${id}-title`;
  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "relative mx-auto w-full max-w-[210mm] overflow-hidden rounded-2xl border border-ink-100 bg-white text-ink-800 shadow-[0_1px_2px_rgb(7_38_60_/_0.04),0_18px_48px_-24px_rgb(7_38_60_/_0.22)] print:max-w-none print:overflow-visible print:rounded-none print:border-0 print:p-[14mm] print:shadow-none print:box-decoration-clone",
        className,
      )}
    >
      <div aria-hidden="true" className={cn("h-1.5", BRAND_RULE)} />

      <div className="px-5 py-6 sm:px-10 sm:py-9 print:px-0 print:pt-5 print:pb-0">
        {/* ── Letterhead ─────────────────────────────────── */}
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-ink-100 pb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <Image src="/brand/suloai-mark.png" alt="" width={226} height={240} className="h-8 w-auto" />
              <span className="font-display text-[1.2rem] font-bold tracking-[0.02em] text-ink-900">
                SULO<span className="text-gradient">AI</span>
              </span>
            </div>
            <p className="mt-1 text-[0.74rem] text-ink-500">{BUSINESS.tagline}</p>
          </div>
          <address className="min-w-0 text-[0.74rem] not-italic leading-relaxed text-ink-600 sm:text-right print:text-right">
            <span className="block">{BUSINESS.addressLines.join(", ")}</span>
            <span className="block">{BUSINESS.email}</span>
            <span className="block">{BUSINESS.website}</span>
          </address>
        </header>

        {/* ── Title ──────────────────────────────────────── */}
        <div className="mt-7 text-center">
          <h2
            id={titleId}
            className="font-display text-[1.45rem] font-bold uppercase leading-tight tracking-[0.06em] text-ink-900 sm:text-[1.7rem]"
          >
            {part.title}
          </h2>
          <p className="mt-2 font-mono text-[0.74rem] tracking-[0.06em] text-ink-600">
            {part.reference} · {dateLabel}
          </p>
          {stamp && (
            <span className="mt-3 inline-block rounded-md border-2 border-red-400 px-2.5 py-1 font-mono text-[0.7rem] font-medium uppercase tracking-[0.2em] text-red-600">
              {stamp}
            </span>
          )}
        </div>

        {/* ── Sections ───────────────────────────────────── */}
        <div className="mt-8 space-y-6">
          {part.sections.map((section, index) => {
            const headingId = `${id}-s${index}`;
            return (
              <section key={headingId} aria-labelledby={headingId} className="min-w-0">
                <h3
                  id={headingId}
                  className="mb-2.5 font-display text-[0.98rem] font-bold text-abyss-600 print:break-after-avoid"
                >
                  {section.number !== null && <span className="tabular-nums">{section.number}. </span>}
                  {section.title}
                </h3>
                <div className="space-y-3">
                  {section.blocks.map((block, i) => (
                    <DocBlock key={i} block={block} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="mt-10 border-t border-ink-100 pt-4 text-center">
          <p className={cn(LABEL, "wrap-anywhere")}>
            {BUSINESS.name} · {BUSINESS.website} · {BUSINESS.email}
          </p>
        </footer>
      </div>
    </article>
  );
}

/**
 * Both parts, as two sheets. `stamp` marks a cancelled agreement on every
 * page; a draft carries no stamp, because the draft is the copy that goes out
 * for signature.
 */
export function AgreementPaper({ doc, stamp }: { doc: AgreementDocument; stamp?: string | null }) {
  return (
    <div className="space-y-6 print:space-y-0">
      <style>{PRINT_PAGE_CSS}</style>
      <Sheet id="agreement" part={doc.agreement} dateLabel={doc.dateLabel} stamp={stamp} />
      <Sheet id="sow" part={doc.sow} dateLabel={doc.dateLabel} stamp={stamp} className="print:break-before-page" />
    </div>
  );
}
