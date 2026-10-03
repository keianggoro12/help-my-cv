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

import type { Credentials, RegistrationInput, UserProfile, UserRole } from "@helpmycv/shared";
import { createId } from "@helpmycv/shared";

import { readJson, removeKey, STORAGE_KEYS, writeJson } from "@/lib/storage";
import { API_ENABLED, api, writeToken } from "@/lib/api-client";

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

export async function signIn(credentials: Credentials, expectedRole: UserRole): Promise<AuthResult> {
  const email = credentials.email.trim().toLowerCase();
  const users = loadUsers();
  const passwords = loadPasswords();

  const user = users[email];
  const storedPassword = passwords[email];

  if (!user || !storedPassword || storedPassword !== credentials.password) {
    return { ok: false, error: "invalidCredentials" };
  }

  // A user account must not be able to sign in at /admin, and vice versa.
  if (user.role !== expectedRole) {
    return { ok: false, error: "adminCredentials" };
  }

  writeJson(STORAGE_KEYS.session, user);

  // If API enabled, call backend to get real JWT token (required for API calls)
  if (API_ENABLED) {
    const result = await api.login({ email, password: credentials.password });
    writeToken(result.token);
    // Update user with backend data (includes imageUrl)
    const updatedUser = { ...user, ...result.user };
    writeJson(STORAGE_KEYS.session, updatedUser);
    return { ok: true, user: updatedUser };
  }

  return { ok: true, user };
}

export async function register(input: RegistrationInput): Promise<AuthResult> {
  if (input.password !== input.confirmPassword) {
    return { ok: false, error: "passwordMismatch" };
  }

  const email = input.email.trim().toLowerCase();
  const users = loadUsers();

  if (users[email]) {
    return { ok: false, error: "emailTaken" };
  }

  const now = new Date().toISOString();
  const newUser: UserProfile = {
    id: createId("usr"),
    name: input.name.trim(),
    email,
    phone: input.phone.trim(),
    role: "user",
    imageUrl: null,
    createdAt: now,
  };

  const updatedUsers = { ...users, [email]: newUser };
  writeJson(STORAGE_KEYS.users, updatedUsers);
  writeJson(STORAGE_KEYS.passwords, { ...loadPasswords(), [email]: input.password });
  writeJson(STORAGE_KEYS.session, newUser);

  // If API enabled, also register on backend
  if (API_ENABLED) {
    const result = await api.register({ name: input.name.trim(), email, password: input.password });
    writeToken(result.token);
    const updatedUser = { ...newUser, ...result.user };
    writeJson(STORAGE_KEYS.session, updatedUser);
    return { ok: true, user: updatedUser };
  }

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

export function updateProfile(userId: string, patch: Partial<UserProfile>): UserProfile | null {
  const users = loadUsers();
  const entry = Object.values(users).find((candidate) => candidate.id === userId);
  if (!entry) {
    return null;
  }

  const updated: UserProfile = { ...entry, ...patch, id: entry.id, role: entry.role };
  const next = { ...users };
  // remove old key if email changed
  if (patch.email && patch.email.toLowerCase() !== entry.email.toLowerCase()) {
    delete next[entry.email.toLowerCase()];
    const emailKey = patch.email.toLowerCase();
    next[emailKey] = { ...updated, email: emailKey };
  } else {
    next[entry.email.toLowerCase()] = updated;
  }

  writeJson(STORAGE_KEYS.users, next);

  if (getSession()?.id === userId) {
    writeJson(STORAGE_KEYS.session, updated);
  }

  return updated;
}
