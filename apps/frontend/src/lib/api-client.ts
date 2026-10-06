/**
 * Thin API client for the Hono backend.
 *
 * Every call is a relative `/api/*` path on purpose: in production the frontend
 * reaches the Worker through a service binding (or the same origin), and an
 * absolute `workers.dev` URL cannot work there — a Worker cannot fetch another
 * Worker on workers.dev. In local dev the base is rewritten by Next to
 * `NEXT_PUBLIC_API_BASE_URL`, so the browser can point at wrangler on :8788.
 *
 * Nothing here knows about React. The stores in `auth-store.ts` and
 * `resume-store.ts` decide whether to call this or read localStorage, so
 * swapping the mock for the real backend is one branch in each store rather
 * than a rewrite of every component.
 */

import type {
  AiConfig,
  AiConfigPayload,
  AiLogEntry,
  ApiResume,
  ApiResumeSummary,
  ApiUser,
  AutoResumePayload,
  CreateResumePayload,
  LoginPayload,
  RegisterPayload,
} from "@helpmycv/shared";

/**
 * Multi-provider config shape returned by /api/admin/ai/configs
 * Each provider has its own config (model + hasApiKey) or null if not saved.
 */
export type AiConfigs = {
  openai: AiConfig | null;
  anthropic: AiConfig | null;
  gemini: AiConfig | null;
};

/**
 * Base URL the *browser* prepends to `/api/*`.
 *
 * Always empty on purpose. `NEXT_PUBLIC_API_BASE_URL` configures the
 * server-side rewrite in `next.config.ts` and points local dev at wrangler on
 * :8788; it must never be used as a fetch base in the browser. Baked in as a
 * literal it makes every call cross-origin to a `workers.dev` host, which fails
 * outright — a browser *can* reach it, but this is exactly the request the
 * backend's own comments rule out, and any CORS or preflight hiccup surfaces
 * only as an opaque "Failed to fetch" with no status to act on. Going through
 * the same-origin rewrite also means the deployed Worker reaches the backend
 * over its `BACKEND` service binding instead of leaving the account.
 */
export const API_BASE = "";

/**
 * True when the app should talk to the real backend instead of localStorage.
 *
 * Keyed off the env var rather than `API_BASE`, which is now always empty.
 */
export const API_ENABLED = process.env.NEXT_PUBLIC_API_BASE_URL !== undefined;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`);
    this.name = "ApiError";
  }
}

const TOKEN_KEY = "helpmycv:api-token";

export function readToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
}

export function writeToken(token: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  if (token === null) {
    window.localStorage.removeItem(TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(TOKEN_KEY, token);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readToken();
  const headers = new Headers(init.headers);
  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  // Attach the session token only when there is one. Sending
  // `Authorization: Bearer null` was equivalent to sending nothing, so this is
  // only a readability fix — the real cause of the signup 401 is in
  // `register()`, which used to publish the local session before writing the
  // token: the dashboard's first `GET /api/resumes` then raced ahead with no
  // token, drew a 401, and the branch below deleted the token that had just
  // arrived, logging the brand-new user straight back out.
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | T
    | null;

  if (!response.ok) {
    const code = (payload as { error?: string } | null)?.error ?? "request_failed";
    // Only a 401 that was *answered* about a token we actually sent means the
    // session is dead. A 401 for a request that carried no token says nothing
    // about any session — it usually means the caller fired before `writeToken`
    // ran — so clearing here would destroy a perfectly good token and turn a
    // transient ordering problem into a logout. Checking `token` distinguishes
    // the two cases exactly.
    if (response.status === 401 && token) {
      writeToken(null);
    }
    throw new ApiError(response.status, code);
  }

  return payload as T;
}

export const api = {
  login(payload: LoginPayload): Promise<{ user: ApiUser; token: string }> {
    return request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
  },

  register(payload: RegisterPayload): Promise<{ user: ApiUser; token: string }> {
    return request("/api/auth/register", { method: "POST", body: JSON.stringify(payload) });
  },

  logout(): Promise<{ ok: true }> {
    return request("/api/auth/logout", { method: "POST" });
  },

  me(): Promise<{ user: ApiUser }> {
    return request("/api/auth/me");
  },

  /**
   * Updates the signed-in user's own name and avatar.
   *
   * There is no id in the path: the server always edits the caller's row, so a
   * client cannot address somebody else's profile. Omitting `imageUrl` leaves
   * the stored avatar untouched, which is what a name-only save needs.
   */
  updateProfile(payload: { name?: string; imageUrl?: string | null }): Promise<{ user: ApiUser }> {
    return request("/api/auth/me", { method: "PATCH", body: JSON.stringify(payload) });
  },

  listResumes(): Promise<{ resumes: ApiResumeSummary[] }> {
    return request("/api/resumes");
  },

  getResume(id: string): Promise<{ resume: ApiResume }> {
    return request(`/api/resumes/${id}`);
  },

  createResume(payload: CreateResumePayload): Promise<{ resume: ApiResume }> {
    return request("/api/resumes", { method: "POST", body: JSON.stringify(payload) });
  },

  updateResume(
    id: string,
    payload: { title?: string; document?: unknown },
  ): Promise<{ resume: ApiResumeSummary }> {
    return request(`/api/resumes/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  deleteResume(id: string): Promise<{ ok: true }> {
    return request(`/api/resumes/${id}`, { method: "DELETE" });
  },

  adminOverview(): Promise<{ stats: { users: number; resumes: number; activeSessions: number } }> {
    return request("/api/admin/overview");
  },

  adminUsers(): Promise<{ users: ApiUser[] }> {
    return request("/api/admin/users");
  },

  adminResumes(): Promise<{
    resumes: (ApiResumeSummary & { ownerEmail: string; ownerName: string })[];
  }> {
    return request("/api/admin/resumes");
  },

  /**
   * One CV as an admin, whoever owns it.
   *
   * Separate from `getResume` because that one is owner-scoped server-side and
   * answers 404 for anyone else — correct for a user, wrong for this screen.
   */
  adminGetResume(id: string): Promise<{ resume: ApiResume }> {
    return request(`/api/admin/resumes/${id}`);
  },

  adminUpdateResume(
    id: string,
    payload: { title?: string; document?: unknown },
  ): Promise<{ resume: ApiResumeSummary }> {
    return request(`/api/admin/resumes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  adminDeleteResume(id: string): Promise<{ ok: true }> {
    return request(`/api/admin/resumes/${id}`, { method: "DELETE" });
  },

  adminUpdateUser(
    id: string,
    payload: { name?: string; role?: string; imageUrl?: string | null },
  ): Promise<{ user: ApiUser }> {
    return request(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  adminDeleteUser(id: string): Promise<{ ok: true }> {
    return request(`/api/admin/users/${id}`, { method: "DELETE" });
  },

  /**
   * Auto CV: the backend runs the configured model, inserts the resume and
   * answers with the same shape `getResume` returns, so opening the editor
   * right after needs no second fetch contract.
   *
   * Provider trouble comes back as the engine's error code in `ApiError.code`
   * (`not_configured`, `invalid_key`, `rate_limited`, `network_error`,
   * `invalid_response`) for the screen to translate.
   */
  generateAutoResume(payload: AutoResumePayload): Promise<{ resume: ApiResume }> {
    return request("/api/ai/generate", { method: "POST", body: JSON.stringify(payload) });
  },

  /** Admin Config: stored AI settings, with the key reduced to a boolean. */
  aiConfig(): Promise<{ config: AiConfig | null }> {
    return request("/api/admin/ai/config");
  },

  /** One cheap round trip to the model, recorded in the log either way. */
  checkAiConfig(): Promise<{ ok: boolean; code: string; message: string }> {
    return request("/api/admin/ai/config/check", { method: "POST" });
  },

  aiLogs(): Promise<{ logs: AiLogEntry[] }> {
    return request("/api/admin/ai/logs");
  },

  /** All providers' configs at once (admin screen). */
  aiConfigs(): Promise<{ configs: AiConfigs }> {
    return request("/api/admin/ai/configs");
  },

  /** Save one provider's config (model + optional apiKey). */
  saveAiConfig(payload: AiConfigPayload): Promise<{ config: AiConfig }> {
    return request("/api/admin/ai/config", { method: "PUT", body: JSON.stringify(payload) });
  },
};