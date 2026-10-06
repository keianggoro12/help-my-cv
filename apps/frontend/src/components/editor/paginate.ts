/**
 * Explicit pagination for the CV sheet.
 *
 * Why this is computed rather than left to the browser:
 *
 *   - `@page { margin: 0 }` is required, or the sheet's own padding would
 *     double up on page 1. With no page margin, every page's padding has to
 *     live inside the page box. A single continuous sheet therefore spends its
 *     top padding on page 1 only, and page 2 begins hard against the paper
 *     edge with nothing above it. That is exactly the cramped second page this
 *     module exists to prevent.
 *
 *   - `break-inside: avoid` on a whole section is all or nothing. A section
 *     taller than the remaining space jumps entire to the next page, so page 1
 *     ends half empty and the content is bunched against the top of page 2.
 *     Both symptoms come from delegating the break point to the print engine.
 *
 * So break points are chosen here, at entry granularity, and each page is
 * rendered as its own box carrying its own padding. Nothing is left for the
 * print engine to decide, which is also what lets the preview draw the same
 * boundaries the PDF will have.
 */

import type { AnyEntry, Resume, ResumeSection, SectionKey } from "@helpmycv/shared";

/** CSS pixels per millimetre at the 96dpi the sheet is laid out in. */
export const MM = 96 / 25.4;

export const A4_WIDTH_PX = 210 * MM;
export const A4_HEIGHT_PX = 297 * MM;
export const PAGE_PAD_Y_PX = 16 * MM;
export const PAGE_PAD_X_PX = 18 * MM;

/** Usable height inside a page's padding. */
export const CONTENT_HEIGHT_PX = A4_HEIGHT_PX - 2 * PAGE_PAD_Y_PX;

/**
 * Headroom left on every page.
 *
 * Pages are measured in the same browser that prints them, but print
 * rasterisation rounds glyph advances slightly differently, so a page filled
 * to the last pixel can spill one line onto a physical page that then has no
 * top padding. A few millimetres of slack absorbs that without being visible.
 */
export const PAGE_SAFETY_PX = 3 * MM;

/** One indivisible block of the document. */
export type PageAtom =
  | { kind: "head"; sectionKey: SectionKey; continued: boolean }
  | { kind: "entry"; sectionKey: SectionKey; entryIndex: number };

/**
 * Sections that will actually be printed, in document order.
 *
 * The preview answers "what will be on the page", so a hidden section stays
 * out and a visible-but-empty section is skipped entirely, heading included —
 * a bare "PROJECTS" over nothing reads as broken on paper.
 */
export function printableSections(resume: Resume): ResumeSection[] {
  return resume.sections.filter(
    (section) =>
      section.visible && section.key !== "personal" && section.entries.items.length > 0,
  );
}

/** Flattens the document into heading-then-entries atoms. */
export function buildAtoms(resume: Resume): PageAtom[] {
  const atoms: PageAtom[] = [];

  for (const section of printableSections(resume)) {
    const sectionKey = section.key as SectionKey;
    atoms.push({ kind: "head", sectionKey, continued: false });

    (section.entries.items as AnyEntry[]).forEach((_, entryIndex) => {
      atoms.push({ kind: "entry", sectionKey, entryIndex });
    });
  }

  return atoms;
}

export interface Capacity {
  /** Usable height on page 1, already reduced by the header. */
  first: number;
  /** Usable height on every later page. */
  rest: number;
}

/**
 * Distributes atoms into pages that each fit their capacity.
 *
 * Two rules do the real work:
 *
 *   - An entry that does not fit starts a new page, where the rest of its
 *     section follows as a group marked "continued". Nothing is repeated in
 *     the render: the continuation opens straight into its entries, keeping
 *     the section gap above them and no heading of its own.
 *
 *   - A heading is never placed unless its first entry fits with it. A heading
 *     stranded at the foot of a page with its entries overleaf reads as a
 *     mistake rather than as a layout.
 *
 * An atom taller than a whole page keeps its own page and overflows it. The
 * alternative is clipping, and silently dropping part of someone's CV is worse
 * than a tight page.
 */
export function paginate(
  atoms: PageAtom[],
  heightOf: (atom: PageAtom, index: number) => number,
  capacity: Capacity,
): PageAtom[][] {
  const pages: PageAtom[][] = [];
  let current: PageAtom[] = [];
  let used = 0;

  // A non-finite measurement must not poison the arithmetic: NaN makes every
  // comparison false, which silently disables the break checks and stacks the
  // whole document onto one page. Treating it as zero can only under-fill a
  // page, never drop content.
  const height = (atom: PageAtom, index: number) => {
    const value = heightOf(atom, index);
    return Number.isFinite(value) ? value : 0;
  };

  const available = () => (pages.length === 0 ? capacity.first : capacity.rest);
  const closePage = () => {
    pages.push(current);
    current = [];
    used = 0;
  };

  /** True once the current page holds real content, not just a heading. */
  const holdsEntry = () => current.some((atom) => atom.kind === "entry");

  for (let index = 0; index < atoms.length; index += 1) {
    const atom = atoms[index];
    const size = height(atom, index);

    if (atom.kind === "entry") {
      // Break only when there is something worth keeping on this page. Breaking
      // after a lone heading would leave a page holding just "EXPERIENCE" and
      // push its own first entry overleaf, which is the orphan heading page
      // this pagination exists to avoid. When the current page has only a
      // heading, the entry stays with it and overflows instead.
      if (used + size > available() && holdsEntry()) {
        closePage();
        const repeated: PageAtom = {
          kind: "head",
          sectionKey: atom.sectionKey,
          continued: true,
        };
        current.push(repeated);
        used += height(repeated, index);
      }
    } else {
      const firstEntry = atoms[index + 1];
      const groupHeight = size + (firstEntry ? height(firstEntry, index + 1) : 0);

      // Keep a heading with its first entry: a heading at the foot of a page
      // with its entries overleaf reads as a mistake rather than a layout.
      if (used + groupHeight > available() && holdsEntry()) {
        closePage();
      }
    }

    current.push(atom);
    used += size;
  }

  if (current.length > 0) {
    closePage();
  }

  return pages.length > 0 ? pages : [[]];
}

/** A section as it appears on one page. */
export interface PageGroup {
  section: ResumeSection;
  sectionKey: SectionKey;
  /** True when this page continues a section started on an earlier page. */
  continued: boolean;
  entries: AnyEntry[];
}

/**
 * Collapses a page's atoms back into sections, so each one renders as a single
 * heading plus its list. Grouping rather than rendering atom by atom keeps the
 * `space-y` lists that give each section its intra-list rhythm.
 */
export function groupPage(atoms: PageAtom[], resume: Resume): PageGroup[] {
  const groups: PageGroup[] = [];

  for (const atom of atoms) {
    const section = resume.sections.find((candidate) => candidate.key === atom.sectionKey);
    if (!section) {
      continue;
    }

    let group = groups[groups.length - 1];
    if (!group || group.sectionKey !== atom.sectionKey) {
      group = {
        section,
        sectionKey: atom.sectionKey,
        continued: false,
        entries: [],
      };
      groups.push(group);
    }

    if (atom.kind === "head") {
      group.continued = atom.continued;
    } else {
      group.entries.push((section.entries.items as AnyEntry[])[atom.entryIndex]);
    }
  }

  return groups;
}

/** Stable key for a page assignment, so the layout effect can skip no-op updates. */
export function paginateSignature(pages: PageAtom[][]): string {
  return pages
    .map((page) =>
      page
        .map((atom) =>
          atom.kind === "head"
            ? `h:${atom.sectionKey}:${atom.continued ? "c" : "n"}`
            : `e:${atom.sectionKey}:${atom.entryIndex}`,
        )
        .join(","),
    )
    .join("|");
}
