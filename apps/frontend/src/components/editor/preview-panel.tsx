"use client";

/**
 * Live preview of the CV, rendered from the same `Resume` object the editor
 * mutates.
 *
 * It is a real DOM render rather than an iframe or an image: the data is
 * already in memory, so re-rendering on every keystroke costs one React pass
 * and needs no PDF pipeline.
 *
 * The sheet is rendered twice — once in the preview column, once into a portal
 * on `document.body` that only exists for print. Printing the on-screen copy
 * is not enough: hiding the rest of the editor with `visibility: hidden` still
 * leaves it occupying layout, so a long form paginates into a dozen blank
 * pages. A separate print root that is `display: none` on screen and
 * `display: block` in print has nothing left to paginate.
 *
 * Only `visible` sections are rendered, in the order the resume stores them:
 * the preview answers "what will actually be on the page", so a hidden section
 * still showing up here would undermine the point of hiding it.
 */

import { Printer, ZoomIn, ZoomOut } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";

import type {
  AchievementEntry,
  AnyEntry,
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  Locale,
  ProjectEntry,
  Resume,
  ResumeTemplateId,
  SectionKey,
  SkillEntry,
  TranslationKey,
} from "@helpmycv/shared";
import { translateSection } from "@helpmycv/shared";

import { ClassicHeader, ClassicSectionBody } from "@/components/editor/classic-sheet";
import {
  PageBody,
  pageBoxClass,
  pageBoxStyle,
  usePagination,
  type RenderBody,
  type RenderHeading,
} from "@/components/editor/page-stack";
import { Button } from "@/components/ui/button";
import { formatDateRange, formatMonthYear } from "@/lib/format";
import { cn } from "@/lib/utils";

/** A4 at 96dpi, used to turn the preview column's width into a fit factor. */
const A4_WIDTH_PX = 794;

interface PreviewPanelProps {
  resume: Resume;
  locale: Locale;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

export function PreviewPanel({ resume, locale, t }: PreviewPanelProps) {
  // `zoom` is a multiplier over "fit the column": 100% means the sheet fills
  // the available width, and the buttons go past that to read small print. The
  // CSS `zoom` property is used rather than a transform because zoom affects
  // layout size, so a shrunk sheet leaves no phantom scroll area behind it.
  const [zoom, setZoom] = React.useState(100);
  const [fitScale, setFitScale] = React.useState(1);
  const [mounted, setMounted] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // `createPortal` needs `document`, so the print copy waits for the client.
  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    function measure() {
      if (!container) {
        return;
      }
      // 32px is the horizontal padding on the scroll area.
      const available = container.clientWidth - 32;
      setFitScale(Math.min(1, Math.max(0.3, available / A4_WIDTH_PX)));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const sections = resume.sections.filter(
    (section) => section.visible && section.key !== "personal",
  );
  const hasAnything =
    resume.personal.fullName.trim() !== "" ||
    sections.some((section) => section.entries.items.length > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("editor.preview")}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("editor.zoomOut")}
            onClick={() => setZoom((value) => Math.max(60, value - 10))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">
            {zoom}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("editor.zoomIn")}
            onClick={() => setZoom((value) => Math.min(140, value + 10))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("editor.print")}
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* `overflow-auto`, not `overflow-y-auto`: past 100% the sheet is
          deliberately wider than the column and you pan across it. */}
      <div ref={scrollRef} className="flex-1 overflow-auto bg-muted/50 p-4">
        {hasAnything ? (
          <div
            className="mx-auto"
            // Laid out at true A4 metrics and scaled by `zoom`, so the text
            // never reflows when the preview size changes.
            style={{ width: "210mm", zoom: fitScale * (zoom / 100) }}
          >
            <SheetByTemplate resume={resume} locale={locale} t={t} mounted={mounted} />
          </div>
        ) : (
          <p className="mx-auto mt-10 max-w-[240px] text-center text-sm text-muted-foreground">
            {t("editor.previewEmpty")}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Picks the layout for `resume.templateId`.
 *
 * The sheet is rendered twice (preview and print) from one `Resume`, so the
 * template has to be resolved in one place or the two copies drift and a PDF
 * comes out in a different template than the screen showed. Unknown and
 * not-yet-built ids fall back to the default layout rather than rendering
 * nothing — a CV with the wrong styling is recoverable, a blank page is not.
 *
 * `variant` also picks the page-box styling: the preview draws a visible page
 * boundary, the print copy must not (a border would print).
 */
/**
 * Resolves the layout for `resume.templateId` and renders both copies from one
 * page assignment.
 *
 * The preview and the print copy have to agree, exactly. Two copies each
 * measuring their own tree cannot: the print copy lives in a `display:none`
 * portal, where every box has zero height, so its pagination would collapse
 * the whole CV onto a single page. Measuring once, in a tree that is in the
 * flow, removes the possibility rather than testing for it.
 *
 * Unknown and not-yet-built template ids fall back to the default layout rather
 * than rendering nothing: a CV with the wrong styling is recoverable, a blank
 * page is not.
 */
function SheetByTemplate({
  resume,
  locale,
  t,
  mounted,
}: {
  resume: Resume;
  locale: Locale;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  /** `createPortal` needs `document`, so the print copy waits for the client. */
  mounted: boolean;
}) {
  const classic = resume.templateId === "classic";

  const header = classic ? (
    <ClassicHeader resume={resume} t={t} />
  ) : (
    <PreviewHeader resume={resume} t={t} />
  );

  const renderHeading: RenderHeading = (_key, title, continued) =>
    classic ? (
      <div>
        {/* A rule above the heading rather than a border under it: the double rule
            under the name already anchors the top of the page, so a boxed heading
            here would stack three horizontal lines within ten millimetres of each
            other. The gap below the heading belongs to PageBody, which counts it
            when deciding where a page breaks. */}
        <div className="flex items-center gap-[3mm]">
          <span className="h-px flex-1 bg-slate-300" />
          <h2 className="text-[10pt] font-bold uppercase tracking-[0.16em] text-slate-900">
            {title}
          </h2>
          <span className="h-px flex-1 bg-slate-300" />
        </div>
        {continued ? (
          <p className="mt-[1.5mm] text-center text-[7.5pt] uppercase tracking-[0.16em] text-slate-400">
            {t("editor.continued")}
          </p>
        ) : null}
      </div>
    ) : (
      <div>
        <h2 className="border-b border-slate-300 pb-[1mm] text-[11pt] font-bold uppercase tracking-wide text-slate-800">
          {title}
        </h2>
        {/* Repeated on a continuation page so page 2 never opens mid-section with
            nothing to say what the entries below it belong to. */}
        {continued ? (
          <p className="mt-[1mm] text-[8pt] uppercase tracking-wide text-slate-400">
            {t("editor.continued")}
          </p>
        ) : null}
      </div>
    );

  const renderBody: RenderBody = (group) =>
    classic ? (
      <ClassicSectionBody
        sectionKey={group.sectionKey}
        items={group.entries}
        locale={locale}
        present={t("field.present")}
        t={t}
      />
    ) : (
      <SectionBody
        sectionKey={group.sectionKey}
        items={group.entries}
        locale={locale}
        present={t("field.present")}
        t={t}
      />
    );

  // Page padding and the sheet's body typography. Passed to the measuring tree
  // as well, so atoms measure at the size they will be drawn.
  const pageClassName = "px-[18mm] py-[16mm] text-[10.5pt] leading-snug";

  const { pages, pageCount, measured, measureTree } = usePagination({
    resume,
    locale,
    className: pageClassName,
    header,
    renderHeading,
    renderBody,
  });

  // Only the preview needs the compact type scale; the print copy inherits the
  // sheet size from print CSS and would otherwise print at browser-default size.
  const printClassName = "px-[18mm] py-[16mm] text-[10.5pt] leading-snug";

  const renderPages = (variant: "preview" | "print", list: typeof pages) =>
    list.map((pageGroups, pageIndex) => (
      <div
        key={pageIndex}
        className={pageBoxClass(variant, variant === "preview" ? pageClassName : printClassName)}
        style={pageBoxStyle(variant)}
        data-page={pageIndex + 1}
      >
        <PageBody
          resume={resume}
          locale={locale}
          header={header}
          pageGroups={pageGroups}
          pageIndex={pageIndex}
          renderHeading={renderHeading}
          renderBody={renderBody}
        />
        {variant === "preview" ? (
          <span className="cv-page-number" aria-hidden>
            {pageIndex + 1}
          </span>
        ) : null}
      </div>
    ));

  return (
    <>
      {/* The measuring tree lives here, beside the visible preview, because this
          is the one place in the document where it can actually be measured. */}
      {measureTree}

      {/* Nothing is rendered until the document has been measured. Rendering the
          un-paginated state would show one very tall sheet with no boundaries,
          which is what the server sends and what a user sees on a slow
          connection: a preview that contradicts the PDF it is supposed to
          predict. A skeleton is honest about not knowing yet. */}
      {measured ? (
        <>
          {/* The count is only meaningful once the pages exist. */}
          <p className="sr-only" role="status">
            {t("editor.pageOf", { page: 1, total: pageCount })}
          </p>
          <div className="flex flex-col gap-[10mm]">{renderPages("preview", pages)}</div>

          {/* Print-only copy: `hidden` on screen, `block` under `@media print`,
              and portalled to `body` because the print CSS hides every other body
              child, and because it has to escape this column's `zoom`, which
              would otherwise scale the printed CV.

              It renders the same `pages` the preview shows, so the PDF cannot
              disagree with the screen. Measuring is not repeated here: this copy
              is `display:none` on screen, where every box measures zero, so a
              second measurement pass would collapse the whole CV onto one page. */}
          {mounted
            ? createPortal(
                <div className="cv-print-root hidden">{renderPages("print", pages)}</div>,
                document.body,
              )
            : null}
        </>
      ) : (
        <div
          aria-hidden
          className="w-[210mm] min-h-[297mm] rounded-sm border border-slate-200 bg-white/50 shadow-inner"
        />
      )}
    </>
  );
}

/** Renders one section's entries using the default (non-classic) styling. */
function SectionBody({
  sectionKey,
  items,
  locale,
  present,
  t,
}: {
  sectionKey: string;
  items: AnyEntry[];
  locale: Locale;
  present: string;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  return <>{renderSection({ key: sectionKey as SectionKey, items, locale, present, t })}</>;
}

function PreviewHeader({
  resume,
  t,
}: {
  resume: Resume;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  const { personal } = resume;
  const contacts = [personal.email, personal.phone, personal.address, personal.portfolioUrl].filter(
    (value) => value.trim() !== "",
  );

  return (
    <header className="border-b-2 border-slate-800 pb-[3mm]">
      <div className="flex items-start gap-[5mm]">
        {personal.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={personal.photoUrl}
            alt=""
            className="h-[24mm] w-[24mm] shrink-0 rounded object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="text-[20pt] font-bold leading-tight text-slate-900">
            {personal.fullName || t("field.fullName")}
          </h1>
          {personal.role ? (
            <p className="mt-[1mm] text-[11pt] font-medium text-slate-700">{personal.role}</p>
          ) : null}
          {contacts.length > 0 ? (
            <p className="mt-[2mm] text-[9pt] text-slate-600">
              {contacts.map((c, idx) => {
                const isEmail = c.includes("@") && !c.startsWith("http");
                return (
                  <span key={idx}>
                    {isEmail ? (
                      <a href={`mailto:${c}`} className="text-slate-600 underline decoration-1 underline-offset-2 hover:text-slate-900">
                        {c}
                      </a>
                    ) : (
                      c
                    )}
                    {idx < contacts.length - 1 ? "  •  " : ""}
                  </span>
                );
              })}
            </p>
          ) : null}
        </div>
      </div>

      {personal.summary ? (
        <p className="mt-[3mm] text-justify text-[9.5pt] text-slate-700">{personal.summary}</p>
      ) : null}
    </header>
  );
}

interface RenderSectionInput {
  key: SectionKey;
  items: AnyEntry[];
  locale: Locale;
  present: string;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

function renderSection({ key, items, locale, present, t }: RenderSectionInput): React.ReactNode {
  if (items.length === 0) {
    return null;
  }

  switch (key) {
    case "experience":
      return (
        <div className="space-y-[3.5mm]">
          {(items as ExperienceEntry[]).map((entry) => (
            <div key={entry.id} className="break-inside-avoid">
              <div className="flex items-baseline justify-between gap-[4mm]">
                <p className="text-[10.5pt] font-semibold text-slate-900">
                  {entry.role || t("field.jobTitle")}
                </p>
                <p className="shrink-0 text-[9pt] text-slate-600">
                  {formatDateRange(entry.startDate, entry.endDate, entry.current, locale, present)}
                </p>
              </div>
              <p className="text-[9.5pt] italic text-slate-700">
                {[entry.company, entry.location, entry.employmentType]
                  .filter((value) => value.trim() !== "")
                  .join(" — ")}
              </p>
              <Bullets bullets={entry.bullets} />
            </div>
          ))}
        </div>
      );

    case "education":
      return (
        <div className="space-y-[3.5mm]">
          {(items as EducationEntry[]).map((entry) => (
            <div key={entry.id} className="break-inside-avoid">
              <div className="flex items-baseline justify-between gap-[4mm]">
                <p className="text-[10.5pt] font-semibold text-slate-900">{entry.institution}</p>
                <p className="shrink-0 text-[9pt] text-slate-600">
                  {formatDateRange(entry.startDate, entry.endDate, entry.current, locale, present)}
                </p>
              </div>
              <p className="text-[9.5pt] italic text-slate-700">
                {[entry.degree, entry.gpa ? `GPA ${entry.gpa}` : "", entry.location]
                  .filter((value) => value.trim() !== "")
                  .join(" — ")}
              </p>
              <Bullets bullets={entry.bullets} />
            </div>
          ))}
        </div>
      );

    case "skills":
      return (
        <ul className="grid grid-cols-2 gap-x-[6mm] gap-y-[1mm] text-[9.5pt] text-slate-700">
          {(items as SkillEntry[]).map((entry) => (
            <li key={entry.id}>
              {entry.name}
              {entry.level ? <span className="text-slate-500"> — {entry.level}</span> : null}
            </li>
          ))}
        </ul>
      );

    case "projects":
      return (
        <div className="space-y-[3.5mm]">
          {(items as ProjectEntry[]).map((entry) => (
            <div key={entry.id} className="break-inside-avoid">
              <div className="flex items-baseline justify-between gap-[4mm]">
                <p className="text-[10.5pt] font-semibold text-slate-900">
                  {entry.name}
                  {entry.url ? (
                    <a
                      href={entry.url.startsWith("http") ? entry.url : `https://${entry.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-normal text-slate-600 underline decoration-1 underline-offset-2 hover:text-slate-900"
                    >
                      {entry.url}
                    </a>
                  ) : null}
                </p>
                <p className="shrink-0 text-[9pt] text-slate-600">
                  {formatDateRange(entry.startDate, entry.endDate, entry.current, locale, present)}
                </p>
              </div>
              <Bullets bullets={entry.bullets} />
            </div>
          ))}
        </div>
      );

    case "achievements":
      return (
        <div className="space-y-[2.5mm]">
          {(items as AchievementEntry[]).map((entry) => (
            <div key={entry.id} className="break-inside-avoid">
              <div className="flex items-baseline justify-between gap-[4mm]">
                <p className="text-[9.5pt] text-slate-800">
                  <span className="font-semibold">{entry.title}</span>
                  {entry.organization ? <span> — {entry.organization}</span> : null}
                  {entry.url ? (
                    <a
                      href={entry.url.startsWith("http") ? entry.url : `https://${entry.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-600 underline decoration-1 underline-offset-2 hover:text-slate-900"
                    >
                      {entry.url}
                    </a>
                  ) : null}
                </p>
                <p className="shrink-0 text-[9pt] text-slate-600">
                  {formatMonthYear(entry.date, locale)}
                </p>
              </div>
              <Bullets bullets={entry.bullets} />
            </div>
          ))}
        </div>
      );

    case "certifications":
      return (
        <ul className="space-y-[1.5mm]">
          {(items as CertificationEntry[]).map((entry) => (
            <li
              key={entry.id}
              className="flex items-baseline justify-between gap-[4mm] text-[9.5pt]"
            >
              <span className="text-slate-800">
                <span className="font-semibold">{entry.name}</span>
                {entry.issuer ? <span className="text-slate-600"> — {entry.issuer}</span> : null}
                {entry.url ? (
                  <a
                    href={entry.url.startsWith("http") ? entry.url : `https://${entry.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-600 underline decoration-1 underline-offset-2 hover:text-slate-900"
                  >
                    {entry.url}
                  </a>
                ) : null}
              </span>
              <span className="shrink-0 text-[9pt] text-slate-600">
                {formatMonthYear(entry.date, locale)}
              </span>
            </li>
          ))}
        </ul>
      );

    default:
      return null;
  }
}

function Bullets({ bullets }: { bullets: AnyEntry["bullets"] }) {
  const filled = bullets.filter((bullet) => bullet.text.trim() !== "");
  if (filled.length === 0) {
    return null;
  }
  return (
    <ul className="mt-[1.5mm] list-disc space-y-[0.8mm] pl-[5mm] text-[9.5pt] text-slate-700">
      {filled.map((bullet) => (
        <li key={bullet.id}>{bullet.text}</li>
      ))}
    </ul>
  );
}