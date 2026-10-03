/**
 * Domain types shared by every Help My CV app.
 *
 * These mirror what the future backend will return. Keeping them in one place
 * means the mock localStorage layer in the frontend can be swapped for real
 * API calls without touching a single component.
 */

export type Locale = "en" | "id";

export type UserRole = "user" | "admin";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  /** Avatar URL. `null` renders the initials fallback. */
  imageUrl: string | null;
  createdAt: string;
}

/** Every section the editor knows how to render. */
export type SectionKey =
  | "personal"
  | "education"
  | "experience"
  | "skills"
  | "projects"
  | "achievements"
  | "certifications";

export interface Bullet {
  id: string;
  text: string;
}

export interface PersonalInfo {
  fullName: string;
  /** Headline / target position, e.g. "Backend Engineer". */
  role: string;
  email: string;
  phone: string;
  address: string;
  portfolioUrl: string;
  summary: string;
  photoUrl: string | null;
}

export interface EducationEntry {
  id: string;
  institution: string;
  location: string;
  /** ISO-ish `YYYY-MM` strings; empty string means "not set". */
  startDate: string;
  endDate: string;
  /** When true the end date is ignored and the UI shows "Present". */
  current: boolean;
  degree: string;
  gpa: string;
  bullets: Bullet[];
}

export interface ExperienceEntry {
  id: string;
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  /** Freelance, contract, internship, full-time — whatever they want called it. */
  employmentType: string;
  bullets: Bullet[];
}

export interface SkillEntry {
  id: string;
  name: string;
  level: string;
  bullets: Bullet[];
}

export interface ProjectEntry {
  id: string;
  name: string;
  url: string;
  startDate: string;
  endDate: string;
  current: boolean;
  bullets: Bullet[];
}

/**
 * Awards, courses, publications, volunteer work — the "other experience" bucket.
 *
 * A single `date` rather than a range: these things happen on one occasion, and
 * a start/end pair would imply a duration the person never claimed.
 */
export interface AchievementEntry {
  id: string;
  title: string;
  organization: string;
  /** `YYYY-MM`; empty string means "not set". */
  date: string;
  url: string;
  bullets: Bullet[];
}

export interface CertificationEntry {
  id: string;
  name: string;
  issuer: string;
  date: string;
  url: string;
  bullets: Bullet[];
}

/**
 * The entry list a section carries.
 *
 * `personal` is in the union even though it never holds entries — it lives on
 * `Resume.personal` instead, and `emptyEntries("personal")` returns an empty
 * `personal` list purely so `ResumeSection` stays uniform. Without it the
 * factory would have to cast, and the shape a stored resume really has (a
 * section whose entries are `[]`) would not be expressible.
 */
export type SectionEntries =
  | { kind: "personal"; items: [] }
  | { kind: "education"; items: EducationEntry[] }
  | { kind: "experience"; items: ExperienceEntry[] }
  | { kind: "skills"; items: SkillEntry[] }
  | { kind: "projects"; items: ProjectEntry[] }
  | { kind: "achievements"; items: AchievementEntry[] }
  | { kind: "certifications"; items: CertificationEntry[] };

export interface ResumeSection {
  key: SectionKey;
  /** Personal Information is pinned: it can neither be hidden nor reordered. */
  visible: boolean;
  /** Optional custom section title; if empty, falls back to translation. */
  title?: string;
  entries: SectionEntries;
}

export type ResumeStatus = "draft" | "final";

export interface Resume {
  id: string;
  userId: string;
  title: string;
  templateId: ResumeTemplateId;
  locale: Locale;
  status: ResumeStatus;
  personal: PersonalInfo;
  sections: ResumeSection[];
  createdAt: string;
  updatedAt: string;
}

export type ResumeTemplateId = "blank" | "modern" | "classic" | "minimal";

export interface ResumeTemplate {
  id: ResumeTemplateId;
  /** Phase 1 ships blank only; the rest are shown as "coming soon". */
  available: boolean;
}

/** Mock sign-in payload. A real backend will replace this. */
export interface Credentials {
  email: string;
  password: string;
}

export interface RegistrationInput {
  name: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
}
