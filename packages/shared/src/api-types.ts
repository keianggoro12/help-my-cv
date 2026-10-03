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