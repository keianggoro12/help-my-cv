"use client";

/**
 * Explicit A4 pagination for the CV sheet.
 *
 * Split into a hook (`usePagination`) and a renderer (`PageBody`) because the
 * break points have to be identical in two places that must never disagree: the
 * preview the user reads, and the copy that prints. If each rendered its own
 * copy and measured its own tree, the print copy would measure nothing (it
 * lives in a `display:none` portal, where every box has zero height), silently
 * put the whole CV on one page, and the PDF would contradict the screen.
 *
 * So the measurement happens once, in a tree that is genuinely in the flow, and
 * both the preview and the print copy render that one page assignment.
 *
 * How the breaks are found:
 *
 *   1. Render every atom (a section heading, or one entry) into a hidden
 *      measuring tree, at the same width and typography as a real page.
 *   2. Read each one's height with `getBoundingClientRect`.
 *   3. Run `paginate` to group the atoms into pages.
 *   4. Both copies render those pages.
 *
 * All vertical rhythm lives here as constants, because the gaps have to be
 * counted when measuring and reproduced when rendering. A template that set its
 * own margins would put the two out of step, and every page would drift a few
 * millimetres out of the capacity the paginator reserved for it.
 */

import * as React from "react";

import type { Locale, Resume, SectionKey, TranslationKey } from "@helpmycv/shared";
import { translateSection } from "@helpmycv/shared";

import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  CONTENT_HEIGHT_PX,
  MM,
  PAGE_PAD_X_PX,
  PAGE_SAFETY_PX,
  type PageAtom,
  type PageGroup,
  buildAtoms,
  groupPage,
  paginate,
  paginateSignature,
} from "@/components/editor/paginate";
import { cn } from "@/lib/utils";

/**
 * Vertical rhythm, in one place.
 *
 *   SECTION_GAP  above every section.
 *   HEADING_GAP  between a section heading and its first entry.
 *
 * Both are added to a heading's measured cost, so the paginator reserves the
 * space the render actually uses. The heading-to-entry gap is not part of the
 * entry's own measured height: in the real page they are separate boxes too.
 */
export const SECTION_GAP_PX = 5 * MM;
export const HEADING_GAP_PX = 2.5 * MM;

/** The page's inner width, matching the padding each page box carries. */
const CONTENT_WIDTH_PX = A4_WIDTH_PX - 2 * PAGE_PAD_X_PX;

export type RenderHeading = (
  sectionKey: SectionKey,
  title: string,
  continued: boolean,
) => React.ReactNode;
export type RenderBody = (group: PageGroup) => React.ReactNode;

/** A section's heading text: the user's override, else the locale's name. */
function headingText(resume: Resume, sectionKey: SectionKey, locale: Locale): string {
  const section = resume.sections.find((candidate) => candidate.key === sectionKey);
  return section?.title?.trim() ? section.title : translateSection(locale, sectionKey);
}

/** A stable DOM id per atom, used to key the measuring tree and read it back. */
function atomId(atom: PageAtom): string {
  return atom.kind === "head"
    ? `h-${atom.sectionKey}-${atom.continued ? "c" : "n"}`
    : `e-${atom.sectionKey}-${atom.entryIndex}`;
}

export interface Pagination {
  /** Section groups per page, ready to render. Empty until measured. */
  pages: PageGroup[][];
  pageCount: number;
  /**
   * False until the document has been measured at least once.
   *
   * Callers must not render `pages` before this is true: the initial value
   * holds every atom on a single page, which renders as one very tall
   * un-broken sheet and is what the server sends to any client that has not
   * hydrated yet.
   */
  measured: boolean;
  /** The hidden measuring tree. Must be mounted somewhere measurable. */
  measureTree: React.ReactNode;
}

/**
 * Measures the document and returns its page assignment.
 *
 * The measuring tree must end up in the document flow and non-zero-sized when
 * this runs; `opacity-0` and absolute positioning keep it invisible without
 * collapsing it. A tree inside `display:none` measures zero, and then every
 * atom trivially "fits" on page 1.
 *
 * `className` is the same class string the real pages get, so atoms measure at
 * the typography and width they will render at. Without it, atoms measure at
 * the inherited 16px and every page comes out half full.
 */
export function usePagination({
  resume,
  locale,
  className,
  header,
  renderHeading,
  renderBody,
}: {
  resume: Resume;
  locale: Locale;
  className?: string;
  header: React.ReactNode;
  renderHeading: RenderHeading;
  renderBody: RenderBody;
}): Pagination {
  const atoms = React.useMemo(() => buildAtoms(resume), [resume]);
  // Until the document has been measured there is no way to know where a page
  // should break, so `measured` gates the page boxes. Guessing would mean the
  // server shipping one un-broken strip (a slow connection, or any client
  // without JS, sees exactly that: the whole CV as a single very tall page,
  // which is the symptom explicit pagination exists to remove). Rendering the
  // measuring frame instead is honest: it looks like the sheet is being laid
  // out, and it never claims a page boundary that does not exist yet.
  const [measured, setMeasured] = React.useState(false);
  const [pages, setPages] = React.useState<PageAtom[][]>(() => [atoms]);
  const measureRef = React.useRef<HTMLDivElement>(null);

  // A signature rather than the array itself: `paginate` allocates fresh objects
  // each call, so comparing by reference would re-render the preview on every
  // keystroke even when the page assignment is unchanged.
  const signature = paginateSignature(pages);

  React.useLayoutEffect(() => {
    const measureRoot = measureRef.current;
    if (!measureRoot || atoms.length === 0) {
      return;
    }
    const rawHeight = (atom: PageAtom, _index: number): number => {
      const el = measureRoot.querySelector<HTMLElement>(
        `[data-atom="${CSS.escape(atomId(atom))}"]`,
      );
      // An atom missing from the measuring tree (a section that changed between
      // render and measure) measures as zero, which can only under-fill a page,
      // never drop content off it.
      return el?.getBoundingClientRect().height ?? 0;
    };

    // A heading carries the section gap above it and the heading gap below it,
    // so the paginator reserves the space the render will use.
    const heightOf = (atom: PageAtom, index: number): number => {
      const base = rawHeight(atom, index);
      return atom.kind === "head" ? base + SECTION_GAP_PX + HEADING_GAP_PX : base;
    };

    const headerHeight =
      measureRoot.querySelector<HTMLElement>('[data-cv-header]')?.getBoundingClientRect().height ?? 0;

    const next = paginate(atoms, heightOf, {
      first: CONTENT_HEIGHT_PX - PAGE_SAFETY_PX - headerHeight,
      rest: CONTENT_HEIGHT_PX - PAGE_SAFETY_PX,
    });

    setPages((current) =>
      paginateSignature(current) === paginateSignature(next) ? current : next,
    );
    setMeasured(true);
    // `signature` is derived from `pages`; depending on it keeps the effect from
    // re-running every render while still re-running whenever the assignment
    // actually changed.
  }, [atoms, signature]);

  const pages2 = React.useMemo(() => pages.map((page) => groupPage(page, resume)), [pages, resume]);

  const measureTree = (
    <div
      ref={measureRef}
      aria-hidden
      // The caller's class, minus the page padding. Padding would inflate every
      // measured atom, but the typography in that same class string is what the
      // atoms must measure at, so it is passed through and the padding is
      // cancelled inline rather than described twice by the caller.
      className={cn("pointer-events-none absolute left-0 top-0 opacity-0", className)}
      style={{ width: CONTENT_WIDTH_PX, padding: 0 }}
    >
      <div data-cv-header={true}>{header}</div>
      {atoms.map((atom) => (
        <div key={atomId(atom)} data-atom={atomId(atom)}>
          {atom.kind === "head" ? (
            <div style={{ marginBottom: HEADING_GAP_PX }}>
              {renderHeading(
                atom.sectionKey,
                headingText(resume, atom.sectionKey, locale),
                atom.continued,
              )}
            </div>
          ) : (
            <EntryAtom atom={atom} resume={resume} renderBody={renderBody} />
          )}
        </div>
      ))}
    </div>
  );

  return { pages: pages2, pageCount: pages2.length, measured, measureTree };
}

/** One entry rendered alone, for measurement. */
function EntryAtom({
  atom,
  resume,
  renderBody,
}: {
  atom: Extract<PageAtom, { kind: "entry" }>;
  resume: Resume;
  renderBody: RenderBody;
}) {
  const section = resume.sections.find((candidate) => candidate.key === atom.sectionKey);
  if (!section) {
    return null;
  }

  return renderBody({
    section,
    sectionKey: atom.sectionKey,
    continued: false,
    entries: [(section.entries.items as never[])[atom.entryIndex]],
  });
}

/** One page's contents: the masthead on page 1, then that page's sections. */
export function PageBody({
  resume,
  locale,
  header,
  pageGroups,
  pageIndex,
  renderHeading,
  renderBody,
}: {
  resume: Resume;
  locale: Locale;
  header: React.ReactNode;
  pageGroups: PageGroup[];
  pageIndex: number;
  renderHeading: RenderHeading;
  renderBody: RenderBody;
}) {
  return (
    <>
      {/* The masthead belongs to page 1 only. Repeating it would read as a
          second, different person on page 2. */}
      {pageIndex === 0 ? header : null}

      {pageGroups.map((group, groupIndex) => (
        <section
          key={`${group.sectionKey}-${groupIndex}`}
          className="cv-section"
          // The first group on page 1 sits under the header, which has no gap of
          // its own. Every other group carries the section gap the paginator
          // reserved for it, including a group that opens a later page.
          style={pageIndex === 0 && groupIndex === 0 ? undefined : { marginTop: SECTION_GAP_PX }}
        >
          <div style={{ marginBottom: HEADING_GAP_PX }}>
            {renderHeading(
              group.sectionKey,
              headingText(resume, group.sectionKey, locale),
              group.continued,
            )}
          </div>
          {renderBody(group)}
        </section>
      ))}
    </>
  );
}

/** The page box's classes, shared by both copies so they cannot drift. */
export function pageBoxClass(variant: "preview" | "print", className?: string): string {
  return cn(
    "cv-page",
    variant === "preview"
      ? "cv-preview-page bg-white text-slate-900 shadow-md"
      : "cv-print-page bg-white text-slate-900",
    className,
  );
}

/** Preview pages only: inline A4 metrics. Print gets its size from print CSS. */
export function pageBoxStyle(variant: "preview" | "print"): React.CSSProperties | undefined {
  return variant === "preview" ? { width: A4_WIDTH_PX, minHeight: A4_HEIGHT_PX } : undefined;
}

export type { PageGroup };
export { A4_HEIGHT_PX, A4_WIDTH_PX };
export type { Locale, TranslationKey };
