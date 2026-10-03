/**
 * Date formatting shared by the CV list, the editor header and the overview.
 *
 * `Intl.DateTimeFormat` is instantiated per call rather than at module scope
 * so the locale follows the in-app language switch; the module is imported by
 * client components only, and the guard keeps a stray server import from
 * formatting in a different locale than the user sees.
 */

import type { Locale } from "@helpmycv/shared";

const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", id: "id-ID" };

export function formatDate(iso: string, locale: Locale = "en"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export const MONTHS: Record<Locale, string[]> = {
  en: [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ],
  id: [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ],
};

export const YEARS = Array.from({ length: 41 }, (_, index) => {
  const year = new Date().getFullYear() + 5 - index;
  return String(year);
});

/**
 * `YYYY-MM` → "Nov 2024" / "Nov 2024".
 *
 * A year on its own is valid input (`YYYY`), because someone who only knows
 * the year should not be forced to invent a month just to satisfy a formatter.
 */
export function formatMonthYear(value: string, locale: Locale = "en"): string {
  const [year, month] = value.split("-");
  if (!year) {
    return "";
  }
  const index = Number(month);
  if (!Number.isFinite(index) || index < 1 || index > 12) {
    return year;
  }
  return `${MONTHS[locale][index - 1]} ${year}`;
}

/** "Mar 2024 – Nov 2024", or "Nov 2024 – Present" while a role is current. */
export function formatDateRange(
  startDate: string,
  endDate: string,
  current: boolean,
  locale: Locale,
  presentLabel: string,
): string {
  const start = formatMonthYear(startDate, locale);
  const end = current ? presentLabel : formatMonthYear(endDate, locale);

  if (start && end) {
    return `${start} – ${end}`;
  }
  return start || end;
}
