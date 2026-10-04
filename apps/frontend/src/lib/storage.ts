/**
 * Mock persistence layer.
 *
 * Everything the app knows is stored in localStorage behind this module, so
 * the UI can be exercised end to end before a backend exists. When the real API
 * lands, only the callers in `auth-store.ts` / `resume-store.ts` change — the
 * components already talk to these functions and never to `localStorage`
 * directly.
 *
 * Keys are namespaced and read defensively: a malformed or legacy payload
 * falls back to the seed instead of throwing during render.
 */

const PREFIX = "helpmycv:";

export const STORAGE_KEYS = {
  users: `${PREFIX}users`,
  /** userId -> password. Mock only; a real backend hashes and stores nothing client-side. */
  passwords: `${PREFIX}passwords`,
  session: `${PREFIX}session`,
  resumes: `${PREFIX}resumes`,
  locale: `${PREFIX}locale`,
} as const;

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const raw = JSON.stringify(value);
    // Only notify when the stored bytes actually change.
    //
    // This is not an optimisation — it is what stops a render loop. The session
    // provider listens for this event and calls `setUser(getSession())`, which
    // produces a fresh object even when the session is unchanged, so any
    // component with `user` in an effect's dependency array re-runs. If the
    // write was a no-op the event still fired, `user` changed identity, and the
    // effect that performed the write ran again: resume-store's cache write
    // looped the editor between `GET /api/resumes/<id>` and a localStorage
    // write forever. React never got a frame to paint, so the editor was a blank
    // page that only recovered on a full reload (where the loop restarted from
    // a clean effect).
    if (window.localStorage.getItem(key) === raw) {
      return;
    }
    window.localStorage.setItem(key, raw);
    // Same-tab listeners (the session provider) only hear about `storage`
    // events for *other* tabs, so dispatch one manually.
    window.dispatchEvent(new CustomEvent("helpmycv:storage", { detail: { key } }));
  } catch {
    // Storage full or blocked — the app still works for this session.
  }
}

export function removeKey(key: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent("helpmycv:storage", { detail: { key } }));
  } catch {
    // See writeJson.
  }
}
