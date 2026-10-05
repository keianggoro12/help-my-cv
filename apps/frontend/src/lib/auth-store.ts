"use client";

/**
 * Mock authentication.
 *
 * Sign-up creates a `user`; the admin account is seeded and cannot be created
 * through the public form. `signIn` takes an expected role so the user login
 * and the admin login reject each other's accounts instead of letting a normal
 * user walk into /admin.
 *
 * When API is enabled, uses the real backend and stores the JWT token.
 */

import type { ApiUser, Credentials, RegistrationInput, UserProfile, UserRole } from "@helpmycv/shared";
import { createId } from "@helpmycv/shared";

import { readJson, removeKey, STORAGE_KEYS, writeJson } from "@/lib/storage";
import { ApiError, API_ENABLED, api, writeToken } from "@/lib/api-client";

type UserMap = Record<string, UserProfile>;
type PasswordMap = Record<string, string>;

export const DEMO_CREDENTIALS = {
  user: { email: "user@helpmycv.id", password: "user12345" },
  admin: { email: "admin@helpmycv.id", password: "admin12345" },
} as const;

export type AuthResult = { ok: true; user: UserProfile } | { ok: false; error: AuthError };

export type AuthError = "invalidCredentials" | "adminCredentials" | "emailTaken" | "passwordMismatch";

function seedUsers(): UserMap {
  const now = new Date().toISOString();
  return {
    [DEMO_CREDENTIALS.user.email]: {
      id: "usr_demo_user",
      name: "Demo User",
      email: DEMO_CREDENTIALS.user.email,
      phone: "+62 812 3456 7890",
      role: "user",
      imageUrl: null,
      createdAt: now,
    },
    [DEMO_CREDENTIALS.admin.email]: {
      id: "usr_demo_admin",
      name: "Demo Admin",
      email: DEMO_CREDENTIALS.admin.email,
      phone: "+62 811 0000 0000",
      role: "admin",
      imageUrl: null,
      createdAt: now,
    },
  };
}

function seedPasswords(): PasswordMap {
  return {
    "user@helpmycv.id": "user12345",
    "admin@helpmycv.id": "admin12345",
  };
}

function loadUsers(): UserMap {
  return readJson<UserMap>(STORAGE_KEYS.users, seedUsers());
}

function loadPasswords(): PasswordMap {
  return readJson<PasswordMap>(STORAGE_KEYS.passwords, seedPasswords());
}

/**
 * Widens an API user to the `UserProfile` the UI renders.
 *
 * The `users` table has no `phone` column and the login response carries no
 * `created_at`, but `UserProfile` requires both — the profile page edits phone
 * and shows "last updated". Anything already held locally wins, so a phone
 * number typed into the profile page is not thrown away by a re-login, and the
 * two values the API cannot supply get harmless defaults rather than `NaN`
 * reaching `toLocaleDateString`.
 *
 * `phoneHint` is what the register form collected on a fresh sign-up: the
 * backend discards it, so without this the field would come back empty on the
 * very first render of the profile page.
 */
function toUserProfile(apiUser: ApiUser, phoneHint?: string): UserProfile {
  const existing = loadUsers()[apiUser.email];
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    role: apiUser.role,
    imageUrl: apiUser.imageUrl ?? existing?.imageUrl ?? null,
    phone: existing?.phone ?? phoneHint ?? "",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
}

export async function signIn(credentials: Credentials, expectedRole: UserRole): Promise<AuthResult> {
  const email = credentials.email.trim().toLowerCase();
  const password = credentials.password;

  // With the API enabled the backend is the only authority on who exists and
  // what their password is. The local mock list is not consulted first: it holds
  // just the two seeded demo accounts, so any real account (a superadmin, say)
  // would be rejected here before the request was ever made.
  if (API_ENABLED) {
    let result: Awaited<ReturnType<typeof api.login>>;
    try {
      result = await api.login({ email, password });
    } catch (error) {
      // A 401 means the credentials were refused; anything else is a transport
      // or server fault and should not be reported as a wrong password.
      if (error instanceof ApiError && error.status === 401) {
        return { ok: false, error: "invalidCredentials" };
      }
      throw error;
    }
    // The role gate stays client-side so a normal user cannot walk into /admin.
    if (result.user.role !== expectedRole) {
      return { ok: false, error: "adminCredentials" };
    }
    writeToken(result.token);
    writeJson(STORAGE_KEYS.session, toUserProfile(result.user));
    return { ok: true, user: toUserProfile(result.user) };
  }

  const users = loadUsers();
  const passwords = loadPasswords();
  const user = users[email];
  const storedPassword = passwords[email];

  if (!user || !storedPassword || storedPassword !== password) {
    return { ok: false, error: "invalidCredentials" };
  }

  // A user account must not be able to sign in at /admin, and vice versa.
  if (user.role !== expectedRole) {
    return { ok: false, error: "adminCredentials" };
  }

  writeJson(STORAGE_KEYS.session, user);

  return { ok: true, user };
}

export async function register(input: RegistrationInput): Promise<AuthResult> {
  if (input.password !== input.confirmPassword) {
    return { ok: false, error: "passwordMismatch" };
  }

  const email = input.email.trim().toLowerCase();
  const password = input.password;

  // With the API live the backend owns the account list, so an address it has
  // never seen is the only thing "taken" can mean. Checking the local mock store
  // first would reject addresses the server does not have, and — worse — the
  // local write below used to publish a session before the token existed, which
  // raced the dashboard's first `GET /api/resumes` into a 401 that then wiped
  // the token and logged the new user straight back out.
  if (API_ENABLED) {
    let result: Awaited<ReturnType<typeof api.register>>;
    try {
      result = await api.register({ name: input.name.trim(), email, password });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        return { ok: false, error: "emailTaken" };
      }
      throw error;
    }
    // Token first, then the session: the session write is what makes the app
    // start fetching, and those fetches need the token to already be there.
    writeToken(result.token);
    const user = toUserProfile(result.user, input.phone.trim());
    writeJson(STORAGE_KEYS.session, user);
    return { ok: true, user };
  }

  const users = loadUsers();
  if (users[email]) {
    return { ok: false, error: "emailTaken" };
  }

  const newUser: UserProfile = {
    id: createId("usr"),
    name: input.name.trim(),
    email,
    phone: input.phone.trim(),
    role: "user",
    imageUrl: null,
    createdAt: new Date().toISOString(),
  };

  writeJson(STORAGE_KEYS.users, { ...users, [email]: newUser });
  writeJson(STORAGE_KEYS.passwords, { ...loadPasswords(), [email]: password });
  writeJson(STORAGE_KEYS.session, newUser);

  return { ok: true, user: newUser };
}

export function getSession(): UserProfile | null {
  return readJson<UserProfile | null>(STORAGE_KEYS.session, null);
}

export function signOut(): void {
  removeKey(STORAGE_KEYS.session);
  if (API_ENABLED) {
    writeToken(null);
    api.logout().catch(() => {});
  }
}

/**
 * Applies a profile edit.
 *
 * With the API live this writes to D1 as well as the local mirror. It used to be
 * localStorage-only, so a name or avatar change was invisible on every other
 * device and vanished on sign-out — the profile page looked like it saved and
 * nothing was stored. `phone` stays local: the `users` table has no column for
 * it, so it is kept per browser and merged back on the next load.
 *
 * Only `name` and `imageUrl` are sent, and the server ignores `role` and
 * `email` regardless — a profile page must not be able to promote itself.
 */
export async function updateProfile(
  userId: string,
  patch: Partial<Pick<UserProfile, "name" | "phone" | "imageUrl">>,
): Promise<UserProfile | null> {
  const users = loadUsers();
  // Fall back to the live session when the id is absent from the local user map.
  // With the API enabled the map is only ever written by the offline register
  // path, so a user who signed up against the backend has a session but no entry
  // here. Bailing out in that case made every profile save a silent no-op: the
  // page reported nothing, no request was made, and the edit was lost — the
  // "update profile doesn't work" symptom. The session is the authority for who
  // is signed in, so it is the right seed when the mirror has not caught up.
  const session = getSession();
  const entry =
    Object.values(users).find((candidate) => candidate.id === userId) ??
    (session?.id === userId ? session : undefined);
  if (!entry) {
    return null;
  }

  const local: UserProfile = { ...entry, ...patch, id: entry.id, role: entry.role };

  if (API_ENABLED) {
    // Name and avatar go to the server; `phone` has no column, so it is only
    // merged locally below. Omitting `imageUrl` when it was not edited keeps a
    // name-only save from clearing the stored avatar.
    const payload: { name?: string; imageUrl?: string | null } = { name: local.name };
    if (patch.imageUrl !== undefined) {
      payload.imageUrl = patch.imageUrl;
    }
    const { user } = await api.updateProfile(payload);
    local.name = user.name;
    if (user.imageUrl !== undefined) {
      local.imageUrl = user.imageUrl;
    }
  }

  // Mirror into the local store so the profile page and `toUserProfile` see the
  // same values without waiting for a round trip.
  const next = { ...users };
  next[local.email.toLowerCase()] = local;
  writeJson(STORAGE_KEYS.users, next);

  if (getSession()?.id === userId) {
    writeJson(STORAGE_KEYS.session, local);
  }

  // Notify session provider subscribers to refresh without a full reload
  if (typeof window !== "undefined") {
    (window as any).__session?.refresh?.();
  }

  return local;
}
