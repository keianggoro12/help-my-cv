import type { SectionKey } from "./types";
import type { TranslationKey } from "./i18n";

/**
 * Field schemas for the entry-based sections.
 *
 * The PRD treats every section the same way: a reorderable list of entries,
 * each with a few fields and bullets, plus add/duplicate/delete. Writing that
 * six times produced six near-identical components that drifted apart the
 * moment one of them gained a field, so the sections are described as data and
 * rendered by one generic card.
 *
 * Two date shapes exist, and the difference is real rather than cosmetic:
 *   - `range` for things that lasted (education, employment, projects)
 *   - `single` for things that happened once (certificates, awards)
 */

export type EntryFieldKey =
  | "institution"
  | "company"
  | "organization"
  | "role"
  | "jobTitle"
  | "jobType"
  | "name"
  | "title"
  | "degree"
  | "gpa"
  | "level"
  | "issuer"
  | "location"
  | "url";

export type EntryField =
  | { kind: "text"; key: EntryFieldKey; label: TranslationKey; placeholder?: string; grow?: boolean }
  /** A date range with its own "present" toggle, e.g. employment. */
  | { kind: "date-range"; startKey: "startDate"; endKey: "endDate"; currentKey: "current" }
  /** One date, e.g. when a certificate was earned. */
  | { kind: "date-single"; key: "date" };

export interface SectionSchema {
  /** Drives the `SectionEntries` union member and the entry factory. */
  key: Exclude<SectionKey, "personal">;
  fields: EntryField[];
  /** Whether entries of this section carry bullet lists. */
  bullets: boolean;
  /**
   * Label above the bullet list, for sections where `bullets` is true.
   *
   * Per-section rather than one shared string because what the bullets describe
   * differs: a school entry's bullets are a description of the course, a job
   * entry's are responsibilities. A single "About me" was wrong for all of them.
   */
  bulletsLabel: TranslationKey;
  emptyKey: TranslationKey;
}

export const SECTION_SCHEMAS: SectionSchema[] = [
  {
    key: "education",
    bullets: true,
    bulletsLabel: "editor.bulletsEducation",
    emptyKey: "editor.emptyEducation",
    fields: [
      { kind: "text", key: "institution", label: "field.institution", grow: true },
      { kind: "text", key: "location", label: "field.location" },
      { kind: "date-range", startKey: "startDate", endKey: "endDate", currentKey: "current" },
      { kind: "text", key: "degree", label: "field.degree" },
      { kind: "text", key: "gpa", label: "field.gpa" },
    ],
  },
  {
    key: "experience",
    bullets: true,
    bulletsLabel: "editor.bulletsExperience",
    emptyKey: "editor.emptyExperience",
    fields: [
      { kind: "text", key: "company", label: "field.company", grow: true },
      { kind: "text", key: "role", label: "field.jobTitle" },
      { kind: "text", key: "location", label: "field.location" },
      { kind: "text", key: "jobType", label: "field.jobType" },
      { kind: "date-range", startKey: "startDate", endKey: "endDate", currentKey: "current" },
    ],
  },
  {
    key: "skills",
    // A skill is a noun with an optional level; there is nothing to narrate.
    bullets: false,
    bulletsLabel: "editor.bulletsSkills",
    emptyKey: "editor.emptySkills",
    fields: [
      { kind: "text", key: "name", label: "field.skill", grow: true },
      { kind: "text", key: "level", label: "field.level" },
    ],
  },
  {
    key: "projects",
    bullets: true,
    bulletsLabel: "editor.bulletsProjects",
    emptyKey: "editor.emptyProjects",
    fields: [
      { kind: "text", key: "name", label: "field.project", grow: true },
      { kind: "text", key: "url", label: "field.url" },
      { kind: "date-range", startKey: "startDate", endKey: "endDate", currentKey: "current" },
    ],
  },
  {
    key: "achievements",
    bullets: true,
    bulletsLabel: "editor.bulletsAchievements",
    emptyKey: "editor.emptyAchievements",
    fields: [
      { kind: "text", key: "title", label: "field.title", grow: true },
      { kind: "text", key: "organization", label: "field.organization" },
      { kind: "text", key: "url", label: "field.url" },
      { kind: "date-single", key: "date" },
    ],
  },
  {
    key: "certifications",
    bullets: false,
    bulletsLabel: "editor.bulletsCertifications",
    emptyKey: "editor.emptyCertifications",
    fields: [
      { kind: "text", key: "name", label: "field.name", grow: true },
      { kind: "text", key: "issuer", label: "field.issuer" },
      { kind: "text", key: "url", label: "field.url" },
      { kind: "date-single", key: "date" },
    ],
  },
];

export function findSectionSchema(key: SectionKey): SectionSchema | null {
  return SECTION_SCHEMAS.find((schema) => schema.key === key) ?? null;
}