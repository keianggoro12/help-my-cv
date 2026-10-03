export type ApiResumeSummary = {
  id: string;
  title: string;
  updatedAt: string;
  userId: string;
};

export type ApiResume = ApiResumeSummary & {
  sections: unknown;
  personal: unknown;
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