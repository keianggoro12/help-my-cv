import type { Locale, Resume, ResumeStatus, ResumeTemplateId } from "./types";

export type ApiResumeSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  /**
   * Read out of the stored `document` blob rather than kept in its own column.
   * The resume list shows a draft/final badge and the overview counts by it, so
   * the summary has to carry it even though the list endpoint never returns the
   * sections themselves.
   */
  status: ResumeStatus;
};

export type ApiResume = ApiResumeSummary & {
  /**
   * The full editor document. Every field the editor needs — sections,
   * personal, templateId, locale — lives inside this one blob; the summary
   * columns are denormalized copies for list views.
   */
  document: Resume;
};

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  /**
   * Avatar URL. Sent by `toApiUser` in the backend's auth route, but optional
   * here: the admin user list omits it, and `register` does not return it yet.
   */
  imageUrl?: string | null;
  /**
   * Join date. Sent by the admin user list, which is the only endpoint that
   * selects `created_at`; login and register do not return it.
   */
  createdAt?: string;
};

export type ApiSession = {
  userId: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = LoginPayload & {
  name: string;
};

export type CreateResumePayload = {
  title: string;
};

/** Providers the Auto CV engine knows how to talk to. */
export type AiProviderId = "openai" | "anthropic" | "gemini";

/**
 * The AI settings an admin saves in Config. The key itself never leaves the
 * backend: clients only get to know whether one is stored.
 */
export type AiConfig = {
  provider: AiProviderId;
  model: string;
  hasApiKey: boolean;
  updatedAt: string;
};

export type AiConfigPayload = {
  provider: AiProviderId;
  model: string;
  /** Leave out to keep the key that is already stored. */
  apiKey?: string;
};

/** One row of the Config log panel: every check and every Auto CV run. */
export type AiLogEntry = {
  id: number;
  kind: "check" | "generate";
  status: "ok" | "error";
  provider: string;
  model: string;
  message: string;
  createdAt: string;
};

export type AutoResumePayload = {
  title: string;
  description: string;
  templateId: ResumeTemplateId;
  locale?: Locale;
};