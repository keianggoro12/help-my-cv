"use client";

/**
 * The "Classic" CV layout.
 *
 * Classic means the formal, print-first CV: serif type, a centred name, ruled
 * lines, dates ranged right. It is the layout that survives contact with an
 * old-school recruiter's printer and it reads as deliberately conservative,
 * which is the point of offering it next to the plainer default.
 *
 * It is a sibling of the default layout in `preview-panel.tsx`, not a variant
 * of it. The two differ in typeface, alignment, rule weight, bullet marker and
 * photo treatment, so sharing a single styled tree would mean a `variant`
 * branch on almost every element and a class name like `text-[10.5pt] font-
 * classic` for each one. Two layouts cost some repetition and buy two
 * documents that are each internally consistent.
 *
 * Print safety is inherited from the caller: this component only produces the
 * sheet body, and `@media print` in globals.css hides the editor around it.
 */

import type {
  AchievementEntry,
  AnyEntry,
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  Locale,
  ProjectEntry,
  Resume,
  SkillEntry,
  TranslationKey,
} from "@helpmycv/shared";
import { translateSection } from "@helpmycv/shared";

import { formatDateRange, formatMonthYear } from "@/lib/format";

interface ClassicSheetProps {
  resume: Resume;
  locale: Locale;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  className?: string;
}

/**
 * Small caps by CSS, not by transforming the string.
 *
 * `uppercase` + `tracking-[0.18em]` at a smaller size is what a print
 * typesetter would set, and it keeps the underlying text intact for copying
 * out of the PDF and for screen readers.
 */
const HEADING = "text-[10pt] font-bold uppercase tracking-[0.16em] text-slate-900";
const BODY = "text-[10pt] leading-[1.35] text-slate-800";
const MUTED = "text-[9pt] text-slate-600";

export function ClassicSheet({ resume, locale, t, className }: ClassicSheetProps) {
  const present = t("field.present");

  return (
    <div className={className}>
      <ClassicHeader resume={resume} t={t} />

      {resume.sections
        .filter(
          (section) =>
            section.visible &&
            section.key !== "personal" &&
            section.entries.items.length > 0,
        )
        .map((section) => (
          <section key={section.key} className="mt-[5mm]">
            {/* A centred rule above the heading rather than a border under it.
                The double rule under the name already anchors the top of the
                page, so repeating a boxed heading here would stack three
                horizontal lines within ten millimetres of each other. */}
            <div className="mb-[2.5mm] flex items-center gap-[3mm]">
              <span className="h-px flex-1 bg-slate-300" />
              <h2 className={HEADING}>
                {section.title?.trim() ? section.title : translateSection(locale, section.key)}
              </h2>
              <span className="h-px flex-1 bg-slate-300" />
            </div>
            <ClassicSectionBody
              sectionKey={section.key}
              items={section.entries.items as AnyEntry[]}
              locale={locale}
              present={present}
              t={t}
            />
          </section>
        ))}
    </div>
  );
}

function ClassicHeader({
  resume,
  t,
}: {
  resume: Resume;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  const { personal } = resume;
  const contacts = [
    personal.email,
    personal.phone,
    personal.address,
    personal.portfolioUrl,
  ].filter((value) => value.trim() !== "");

  return (
    <header className="text-center">
      {/* The photo sits above the name in classic layouts rather than beside
          it. Side by side with a centred block it either breaks the centring
          or forces the name off-axis, and a photo that small next to a
          20pt name reads as an afterthought. */}
      {personal.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={personal.photoUrl}
          alt=""
          className="mx-auto mb-[3mm] h-[20mm] w-[20mm] object-cover grayscale"
        />
      ) : null}

      <h1 className="text-[22pt] font-bold uppercase leading-none tracking-[0.08em] text-slate-900">
        {personal.fullName || t("field.fullName")}
      </h1>

      {personal.role ? (
        <p className="mt-[2.5mm] text-[10.5pt] font-semibold uppercase tracking-[0.14em] text-slate-700">
          {personal.role}
        </p>
      ) : null}

      {contacts.length > 0 ? (
        <p className={`mt-[3mm] ${MUTED}`}>
          {contacts.map((value, index) => {
            const isEmail = value.includes("@") && !value.startsWith("http");
            return (
              <span key={index}>
                {isEmail ? (
                  <a
                    href={`mailto:${value}`}
                    className="text-slate-600 underline decoration-slate-400 decoration-1 underline-offset-2 hover:text-slate-900"
                  >
                    {value}
                  </a>
                ) : (
                  value
                )}
                {/* A middot with hair spacing, not a bullet: the bullet glyph
                    already means "achievement" further down the page. */}
                {index < contacts.length - 1 ? (
                  <span className="px-[2mm] text-slate-400">·</span>
                ) : null}
              </span>
            );
          })}
        </p>
      ) : null}

      {/* Double rule: the classic masthead. One rule reads unfinished, three
          reads as a table. */}
      <div className="mt-[4mm] border-b-[0.6mm] border-slate-800" />
      <div className="mt-[0.8mm] border-b-px border-slate-400" />

      {personal.summary ? (
        <p className="mx-auto mt-[4mm] max-w-[150mm] text-justify text-[9.5pt] leading-[1.45] text-slate-700">
          {personal.summary}
        </p>
      ) : null}
    </header>
  );
}

interface ClassicSectionInput {
  sectionKey: string;
  items: AnyEntry[];
  locale: Locale;
  present: string;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

/**
 * One row per entry, with the title and its date range sharing a baseline.
 *
 * Classic entries hang their detail lines off the title rather than listing
 * everything in one flowing sentence, so the eye lands on the title first.
 */
function ClassicSectionBody({
  sectionKey,
  items,
  locale,
  present,
  t,
}: ClassicSectionInput) {
  switch (sectionKey) {
    case "experience":
      return (
        <div className="space-y-[3.5mm]">
          {(items as ExperienceEntry[]).map((entry) => (
            <div key={entry.id} className="break-inside-avoid">
              <ClassicEntryHead
                title={entry.role || t("field.jobTitle")}
                date={formatDateRange(entry.startDate, entry.endDate, entry.current, locale, present)}
              />
              {detail([entry.company, entry.location, entry.employmentType]) ? (
                <p className={`mt-[0.5mm] italic ${MUTED}`}>
                  {detail([entry.company, entry.location, entry.employmentType])}
                </p>
              ) : null}
              <ClassicBullets bullets={entry.bullets} />
            </div>
          ))}
        </div>
      );

    case "education":
      return (
        <div className="space-y-[3.5mm]">
          {(items as EducationEntry[]).map((entry) => (
            <div key={entry.id} className="break-inside-avoid">
              <ClassicEntryHead
                title={entry.institution}
                date={formatDateRange(entry.startDate, entry.endDate, entry.current, locale, present)}
              />
              {detail([entry.degree, entry.gpa ? `GPA ${entry.gpa}` : "", entry.location]) ? (
                <p className={`mt-[0.5mm] italic ${MUTED}`}>
                  {detail([entry.degree, entry.gpa ? `GPA ${entry.gpa}` : "", entry.location])}
                </p>
              ) : null}
              <ClassicBullets bullets={entry.bullets} />
            </div>
          ))}
        </div>
      );

    case "projects":
      return (
        <div className="space-y-[3.5mm]">
          {(items as ProjectEntry[]).map((entry) => (
            <div key={entry.id} className="break-inside-avoid">
              <ClassicEntryHead
                title={entry.name}
                date={formatDateRange(entry.startDate, entry.endDate, entry.current, locale, present)}
              />
              {entry.url ? <ClassicUrl url={entry.url} className={`mt-[0.5mm] ${MUTED}`} /> : null}
              <ClassicBullets bullets={entry.bullets} />
            </div>
          ))}
        </div>
      );

    case "achievements":
      return (
        <div className="space-y-[2.5mm]">
          {(items as AchievementEntry[]).map((entry) => (
            <div key={entry.id} className="break-inside-avoid">
              <ClassicEntryHead
                title={
                  detail([entry.title, entry.organization]) ||
                  t("entry.achievements")
                }
                date={formatMonthYear(entry.date, locale)}
                titleClassName="text-[10pt] font-semibold text-slate-900"
              />
              {entry.url ? <ClassicUrl url={entry.url} className={`mt-[0.5mm] ${MUTED}`} /> : null}
              <ClassicBullets bullets={entry.bullets} />
            </div>
          ))}
        </div>
      );

    case "certifications":
      return (
        <div className="space-y-[2mm]">
          {(items as CertificationEntry[]).map((entry) => (
            <div key={entry.id} className="flex items-baseline justify-between gap-[4mm] break-inside-avoid">
              <p className={`${BODY} min-w-0`}>
                <span className="font-semibold">{entry.name}</span>
                {entry.issuer ? (
                  <span className="text-slate-600"> — {entry.issuer}</span>
                ) : null}
                {entry.url ? (
                  <>
                    {" "}
                    <ClassicUrl url={entry.url} className={MUTED} />
                  </>
                ) : null}
              </p>
              <p className={`${MUTED} shrink-0`}>{formatMonthYear(entry.date, locale)}</p>
            </div>
          ))}
        </div>
      );

    case "skills":
      // Skills read as a sentence in classic layouts: "Languages: Go, Rust"
      // rather than a grid, because a two-column grid on a single page puts
      // the right-hand skills visually lower than the left-hand ones and the
      // reader scans across instead of down.
      return (
        <p className={`${BODY} leading-[1.6]`}>
          {(items as SkillEntry[]).map((entry, index) => (
            <span key={entry.id}>
              {index > 0 ? <span className="px-[2mm] text-slate-400">·</span> : null}
              <span className="font-semibold">{entry.name}</span>
              {entry.level ? (
                <span className="text-slate-600"> ({entry.level})</span>
              ) : null}
            </span>
          ))}
        </p>
      );

    default:
      return null;
  }
}

function ClassicEntryHead({
  title,
  date,
  titleClassName,
}: {
  title: string;
  date: string;
  titleClassName?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-[4mm]">
      <p className={titleClassName ?? `${BODY} font-semibold text-slate-900`}>{title}</p>
      {date ? <p className={`${MUTED} shrink-0`}>{date}</p> : null}
    </div>
  );
}

function ClassicBullets({ bullets }: { bullets: AnyEntry["bullets"] }) {
  const filled = bullets.filter((bullet) => bullet.text.trim() !== "");
  if (filled.length === 0) {
    return null;
  }
  return (
    // An en dash instead of a disc. A filled round bullet next to a filled
    // round photo placeholder is the modern convention; the dash is the
    // older one and keeps the page reading as a document rather than as a
    // slide.
    <ul className="mt-[1mm] space-y-[0.6mm] text-[9.5pt] leading-[1.4] text-slate-700">
      {filled.map((bullet) => (
        <li key={bullet.id} className="flex gap-[2mm]">
          <span className="shrink-0 text-slate-400">–</span>
          <span className="min-w-0">{bullet.text}</span>
        </li>
      ))}
    </ul>
  );
}

function ClassicUrl({ url, className }: { url: string; className?: string }) {
  return (
    <a
      href={url.startsWith("http") ? url : `https://${url}`}
      target="_blank"
      rel="noreferrer"
      className={`${className ?? MUTED} underline decoration-slate-400 decoration-1 underline-offset-2 hover:text-slate-900`}
    >
      {url}
    </a>
  );
}

/** Joins the non-empty parts of an entry's subtitle with an en dash. */
function detail(parts: string[]): string {
  return parts.filter((part) => part.trim() !== "").join(" — ");
}
