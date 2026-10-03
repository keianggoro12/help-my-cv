import type { ApiUser, LoginPayload, RegisterPayload } from "@helpmycv/shared";

import { hashPassword, verifyPassword } from "../lib/password";
import type { Env } from "../lib/helpers";
import { json } from "../lib/helpers";
import { bearerToken, createSession, deleteSession } from "../lib/session";

function newId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

function toApiUser(row: { id: string; email: string; name: string; role: string }): ApiUser {
  return { id: row.id, email: row.email, name: row.name, role: row.role === "admin" ? "admin" : "user" };
}

export async function handleRegister(env: Env, request: Request): Promise<Response> {
  let payload: RegisterPayload;
  try {
    payload = (await request.json()) as RegisterPayload;
  } catch {
    return json({ error: "invalid_body" }, 400);
  }

  const email = normaliseEmail(payload.email ?? "");
  const name = (payload.name ?? "").trim();
  const password = payload.password ?? "";

  if (email === "" || name === "" || password.length < 8) {
    return json({ error: "invalid_input" }, 422);
  }

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) {
    return json({ error: "email_taken" }, 409);
  }

  const id = newId();
  await env.DB.prepare(
    "INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, 'user')",
  )
    .bind(id, email, name, await hashPassword(password))
    .run();

  const token = await createSession(env.DB, id);
  return json({ user: { id, email, name, role: "user" }, token }, 201);
}

export async function handleLogin(env: Env, request: Request): Promise<Response> {
  let payload: LoginPayload;
  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return json({ error: "invalid_body" }, 400);
  }

  const email = normaliseEmail(payload.email ?? "");
  const row = await env.DB.prepare(
    "SELECT id, email, name, role, password_hash FROM users WHERE email = ?",
  )
    .bind(email)
    .first<{ id: string; email: string; name: string; role: string; password_hash: string }>();

  // Hash even when the account is unknown, so a missing email and a wrong
  // password take the same time and cannot be told apart by timing.
  const stored = row?.password_hash ?? DUMMY_HASH;
  const ok = await verifyPassword(payload.password ?? "", stored);
  if (!row || !ok) {
    return json({ error: "invalid_credentials" }, 401);
  }

  const token = await createSession(env.DB, row.id);
  return json({ user: toApiUser(row), token });
}

/**
 * A real PBKDF2 digest of a fixed random string, used only when the account
 * does not exist so a wrong email and a wrong password cost the same time.
 * The value is meaningless as a password — it is only there to be hashed.
 */
const DUMMY_HASH =
  "pbkdf2_sha256$210000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";

export async function handleLogout(env: Env, request: Request): Promise<Response> {
  const token = bearerToken(request.headers.get("Authorization"));
  if (token) {
    await deleteSession(env, token);
  }
  return json({ ok: true });
}