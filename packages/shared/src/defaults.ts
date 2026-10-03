import type {
  AchievementEntry,
  Bullet,
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
  Resume,
  ResumeSection,
  ResumeTemplate,
  ResumeTemplateId,
  SectionKey,
  SkillEntry,
} from "./types";

/**
 * Bullet helpers.
 *
 * The PRD asks for three bullets by default but explicitly not a cap, so
 * `DEFAULT_BULLET_COUNT` only seeds a new entry; users can add more freely.
 */
export const DEFAULT_BULLET_COUNT = 3;

export function createId(prefix: string): string {
  const random =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}

export function createBullets(count: number = DEFAULT_BULLET_COUNT): Bullet[] {
  return Array.from({ length: count }, () => ({ id: createId("b"), text: "" }));
}

/** Any entry in any section: all of them carry an id and a bullet list. */
export type AnyEntry =
  | EducationEntry
  | ExperienceEntry
  | SkillEntry
  | ProjectEntry
  | AchievementEntry
  | CertificationEntry;

export function createEmptyEducationEntry(): EducationEntry {
  return {
    id: createId("edu"),
    institution: "",
    location: "",
    startDate: "",
    endDate: "",
    current: false,
    degree: "",
    gpa: "",
    bullets: createBullets(),
  };
}

export function createEmptyExperienceEntry(): ExperienceEntry {
  return {
    id: createId("exp"),
    company: "",
    role: "",
    location: "",
    startDate: "",
    endDate: "",
    current: false,
    employmentType: "",
    bullets: createBullets(),
  };
}

/** Skills are nouns, not achievements, so they get no bullets. */
export function createEmptySkillEntry(): SkillEntry {
  return { id: createId("skill"), name: "", level: "", bullets: [] };
}

export function createEmptyProjectEntry(): ProjectEntry {
  return {
    id: createId("proj"),
    name: "",
    url: "",
    startDate: "",
    endDate: "",
    current: false,
    bullets: createBullets(),
  };
}

export function createEmptyAchievementEntry(): AchievementEntry {
  return {
    id: createId("achv"),
    title: "",
    organization: "",
    date: "",
    url: "",
    bullets: createBullets(),
  };
}

export function createEmptyCertificationEntry(): CertificationEntry {
  return {
    id: createId("cert"),
    name: "",
    issuer: "",
    date: "",
    url: "",
    bullets: [],
  };
}

/**
 * A blank entry for a section, dispatched on the section key.
 *
 * Callers go through this instead of importing each factory, so adding a
 * section does not mean adding a branch at every call site.
 */
export function createEmptySectionEntries(key: Exclude<SectionKey, "personal">): AnyEntry {
  switch (key) {
    case "education":
      return createEmptyEducationEntry();
    case "experience":
      return createEmptyExperienceEntry();
    case "skills":
      return createEmptySkillEntry();
    case "projects":
      return createEmptyProjectEntry();
    case "achievements":
      return createEmptyAchievementEntry();
    case "certifications":
      return createEmptyCertificationEntry();
  }
}

/** Section order a brand new resume starts with. */
export const DEFAULT_SECTION_ORDER: SectionKey[] = [
  "personal",
  "education",
  "experience",
  "skills",
  "projects",
  "achievements",
  "certifications",
];

export function createDefaultSections(): ResumeSection[] {
  return DEFAULT_SECTION_ORDER.map((key) => ({
    key,
    visible: true,
    entries: emptyEntries(key),
  }));
}

export function emptyEntries(key: SectionKey): ResumeSection["entries"] {
  switch (key) {
    case "personal":
      return { kind: "personal", items: [] };
    case "education":
      return { kind: "education", items: [] };
    case "experience":
      return { kind: "experience", items: [] };
    case "skills":
      return { kind: "skills", items: [] };
    case "projects":
      return { kind: "projects", items: [] };
    case "achievements":
      return { kind: "achievements", items: [] };
    case "certifications":
      return { kind: "certifications", items: [] };
  }
}

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  { id: "blank", available: true },
  { id: "modern", available: false },
  { id: "classic", available: false },
  { id: "minimal", available: false },
];

export function isTemplateAvailable(id: ResumeTemplateId): boolean {
  return RESUME_TEMPLATES.find((template) => template.id === id)?.available ?? false;
}

export function createResume(input: {
  id: string;
  userId: string;
  title: string;
  templateId?: ResumeTemplateId;
  locale?: Resume["locale"];
  email?: string;
}): Resume {
  const now = new Date().toISOString();
  return {
    id: input.id,
    userId: input.userId,
    title: input.title,
    templateId: input.templateId ?? "blank",
    locale: input.locale ?? "en",
    status: "draft",
    personal: {
      fullName: "",
      role: "",
      email: input.email ?? "",
      phone: "",
      address: "",
      portfolioUrl: "",
      summary: "",
      photoUrl: null,
    },
    sections: createDefaultSections(),
    createdAt: now,
    updatedAt: now,
  };
}
