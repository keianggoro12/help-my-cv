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
  SectionKey,
  SkillEntry,
  TranslationKey,
} from "@helpmycv/shared";
import { translateSection } from "@helpmycv/shared";

import { Button } from "@/components/ui/button";
import { formatDateRange, formatMonthYear } from "@/lib/format";

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
            <CvSheet
              resume={resume}
              locale={locale}
              t={t}
              className="cv-preview-page bg-white px-[18mm] py-[16mm] text-[10.5pt] leading-snug text-slate-900 shadow-md"
            />
          </div>
        ) : (
          <p className="mx-auto mt-10 max-w-[240px] text-center text-sm text-muted-foreground">
            {t("editor.previewEmpty")}
          </p>
        )}
      </div>

      {/* Print-only copy: `hidden` on screen, `block` under `@media print`. */}
      {mounted && hasAnything
        ? createPortal(
            <div className="cv-print-root hidden">
              <CvSheet
                resume={resume}
                locale={locale}
                t={t}
                className="cv-print-sheet bg-white px-[18mm] py-[16mm] text-[10.5pt] leading-snug text-slate-900"
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** The document itself: header plus every visible section, in order. */
function CvSheet({
  resume,
  locale,
  t,
  className,
}: {
  resume: Resume;
  locale: Locale;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  className?: string;
}) {
  const present = t("field.present");

  return (
    <div className={className}>
      <PreviewHeader resume={resume} t={t} />

      {/* A section with no entries is skipped entirely — including its heading.
          In the editor an empty section is still something to click into, but
          on paper a bare "PROJECTS" with nothing under it looks broken. */}
      {resume.sections
        .filter(
          (section) =>
            section.visible &&
            section.key !== "personal" &&
            section.entries.items.length > 0,
        )
        .map((section) => (
          <section key={section.key} className="mt-[6mm]">
            <h2 className="mb-[2mm] border-b border-slate-300 pb-[1mm] text-[11pt] font-bold uppercase tracking-wide text-slate-800">
              {section.title?.trim() ? section.title : translateSection(locale, section.key)}
            </h2>
            {renderSection({
              key: section.key,
              items: section.entries.items as AnyEntry[],
              locale,
              present,
              t,
            })}
          </section>
        ))}
    </div>
  );
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