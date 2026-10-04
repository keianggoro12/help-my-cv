import type { Resume, ResumeStatus } from "./types";

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