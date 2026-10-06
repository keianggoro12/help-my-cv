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
 * The models the Config screen offers for each provider.
 *
 * The list is deliberately small: a handful of CURRENT ids per provider, the
 * ones that still exist. Old ids (gemini-2.5-*, gpt-4o-*, claude-3-*) drop off
 * the list when Google retires them; picking a retired id makes Check fail
 * with a log line the admin has to puzzle through, so out of service ids are
 * never offered. A provided model id is sent to the provider verbatim — the
 * backend does not remap or translate it.
 */
export const AI_MODELS: Record<AiProviderId, string[]> = {
  openai: ["gpt-5.4-mini", "gpt-5.2", "gpt-5-mini", "gpt-5-nano", "gpt-4.1-mini", "gpt-4.1-nano"],
  anthropic: [
    "claude-haiku-4-5",
    "claude-sonnet-4-6",
    "claude-sonnet-5",
    "claude-opus-4-8",
    "claude-fable-5",
  ],
  gemini: ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-pro-preview"],
};

/** Defaults shown when a provider is selected but nothing is saved yet. */
export const AI_DEFAULT_MODELS: Record<AiProviderId, string> = {
  openai: AI_MODELS.openai[0],
  anthropic: AI_MODELS.anthropic[0],
  gemini: AI_MODELS.gemini[0],
};

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