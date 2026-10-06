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
  printableSections,
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

/**
 * Element height in layout pixels, with any CSS `zoom` on its ancestors undone.
 *
 * The measuring tree lives inside the preview column, which is `zoom`ed to fit
 * the sheet into the panel. `getBoundingClientRect` reports the *scaled* rect,
 * so under a 0.47 fit factor every atom measures about half its real height
 * while `CONTENT_HEIGHT_PX` stays at true A4 metrics — the whole document then
 * "fits" on one sheet. That single mistake is what made the preview render one
 * over-tall page with no boundary, let the print engine split the same box
 * wherever it liked, and put page 2 hard against the paper edge.
 *
 * `offsetHeight` would also be unscaled, but it is rounded to whole pixels and
 * its zoom semantics are not uniform across engines; dividing the rect by the
 * accumulated `zoom` of the ancestor chain is exact. Browsers without `zoom`
 * report an empty computed value and are left alone (their rects are unscaled
 * already).
 */
function layoutHeight(el: HTMLElement): number {
  const rect = el.getBoundingClientRect().height;
  let zoom = 1;

  for (let node: Element | null = el; node; node = node.parentElement) {
    const spec = window.getComputedStyle(node).zoom;
    if (!spec) {
      continue;
    }
    const value = parseFloat(spec);
    if (!Number.isFinite(value)) {
      continue;
    }
    zoom *= spec.trim().endsWith("%") ? value / 100 : value;
  }

  return zoom > 0 ? rect / zoom : rect;
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
  // Seed with the full document on one page. We measure and replace with
  // paginated pages in useLayoutEffect. This avoids blank frames and keeps the
  // first paint predictable; the re-measure may cause a small reflow but the
  // previous gating caused the preview to appear empty or "stuck" in prod.
  const [pages, setPages] = React.useState<PageAtom[][]>(() => [atoms]);
  const [measured, setMeasured] = React.useState(false);
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
      return el ? layoutHeight(el) : 0;
    };

    // The `space-y` rhythm between two entries, read off the probes rendered
    // with the template's own markup. `offsetTop` differences are layout
    // pixels, so they are unaffected by the preview's `zoom`, and taking the
    // number from the markup itself means a template that changes its rhythm
    // cannot pull the paginator out of step with the sheet. A grid reports its
    // two probe entries on one row, which measures as no gap; that section then
    // keeps charging its flat, slightly generous estimate.
    const gaps = new Map<string, number>();
    const readGaps = () => {
      gaps.clear();
      measureRoot.querySelectorAll<HTMLElement>("[data-gap-probe]").forEach((probe) => {
        const host = [probe, probe.firstElementChild].find(
          (node): node is HTMLElement => node !== null && node.children.length >= 2,
        );
        if (!host) {
          return;
        }
        const first = host.children[0] as HTMLElement;
        const second = host.children[1] as HTMLElement;
        const gap = second.offsetTop - first.offsetTop - first.offsetHeight;
        if (gap > 0) {
          gaps.set(probe.dataset.gapProbe ?? "", gap);
        }
      });
    };

    // A heading carries the section gap above it and the heading gap below it,
    // so the paginator reserves the space the render will use. An entry that
    // directly follows another entry of its own section carries the list gap
    // between them; the first entry under a heading starts a fresh list and
    // carries none.
    //
    // The very first heading carries no section gap: `PageBody` gives page 1's
    // first section no top margin, and charging it anyway would cost one
    // heading's worth of room on the page that has the least to spare.
    const heightOf = (atom: PageAtom, index: number): number => {
      const base = rawHeight(atom, index);
      if (atom.kind === "head") {
        const sectionGap = index === 0 ? 0 : SECTION_GAP_PX;
        return base + sectionGap + HEADING_GAP_PX;
      }
      const previous = atoms[index - 1];
      const spaced = previous?.kind === "entry" && previous.sectionKey === atom.sectionKey;
      return spaced ? base + (gaps.get(atom.sectionKey) ?? 0) : base;
    };

    // Measuring synchronously here is safe: this effect runs after the tree has
    // been committed, and getBoundingClientRect forces the layout flush, so the
    // numbers describe the DOM that is actually on screen.
    //
    // This used to wait for requestAnimationFrame, which never fires while the
    // page is hidden (a background tab, the print preview, a loading iframe) —
    // the paginator then silently never ran and the sheet stayed on its
    // single over-tall seed page until something else touched it. Nothing about
    // the measurement needs a painted frame, so it does not wait for one.
    const measure = () => {
      readGaps();
      const headerEl = measureRoot.querySelector<HTMLElement>('[data-cv-header]');
      const headerHeight = headerEl ? layoutHeight(headerEl) : 0;
      const next = paginate(atoms, heightOf, {
        first: CONTENT_HEIGHT_PX - PAGE_SAFETY_PX - headerHeight,
        rest: CONTENT_HEIGHT_PX - PAGE_SAFETY_PX,
      });
      setPages((current) => {
        const sig = paginateSignature(next);
        const curSig = paginateSignature(current);
        if (sig === curSig) return current;
        return next;
      });
      setMeasured(true);
    };

    measure();

    // Line boxes move when the web font lands, and the header photo changes the
    // header's height when it decodes — either one can push a page over the A4
    // limit after the first measurement, so both re-run it.
    let cancelled = false;
    const remeasure = () => {
      if (!cancelled) measure();
    };
    document.fonts?.ready.then(remeasure).catch(() => undefined);
    const images = measureRoot.querySelectorAll('img');
    images.forEach((img) => {
      if (!img.complete) img.addEventListener('load', remeasure, { once: true });
    });
    return () => {
      cancelled = true;
      images.forEach((img) => img.removeEventListener('load', remeasure));
    };
  }, [atoms]);

  // Safety fallback: if measurement somehow never completes (e.g. the measuring
  // tree fails to report heights in a particular layout), force a render so the
  // preview does not stay permanently blank. This trades off a possible small
  // mis-paginated first frame for never getting stuck in an empty state.
  React.useEffect(() => {
    if (measured) {
      return;
    }
    const t = setTimeout(() => {
      setPages((current) => (current.length === 0 ? [atoms] : current));
      setMeasured(true);
    }, 1000);
    return () => clearTimeout(t);
  }, [measured, atoms]);

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
      data-testid="measure-tree"
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

      {/* Entry-gap probes.
          The `space-y` rhythm between entries lives in each template's own
          markup, so the paginator reads it from a probe rendered with that
          same markup rather than restating a millimetre value here — a second
          copy of the spacing would drift the moment a template changed it.
          Two entries are enough: the space between them is the gap, and a grid
          (skills) reports its entries on one row, which reads as no gap and
          costs nothing. */}
      {printableSections(resume).map((section) => {
        const sectionKey = section.key as SectionKey;
        const items = section.entries.items as never[];
        if (items.length < 2) {
          return null;
        }
        return (
          <div key={`gap-${sectionKey}`} data-gap-probe={sectionKey}>
            {renderBody({
              section,
              sectionKey,
              continued: false,
              entries: items.slice(0, 2),
            })}
          </div>
        );
      })}
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
