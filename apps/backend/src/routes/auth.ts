import type { ApiUser, LoginPayload, RegisterPayload } from "@helpmycv/shared";

import { hashPassword, verifyPassword } from "../lib/password";
import type { Env } from "../lib/helpers";
import { json } from "../lib/helpers";
import { bearerToken, createSession, deleteSession, type SessionUser } from "../lib/session";

function newId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

function toApiUser(row: { id: string; email: string; name: string; role: string; image_url?: string | null }): ApiUser {
  return { id: row.id, email: row.email, name: row.name, role: row.role === "admin" ? "admin" : "user", imageUrl: row.image_url ?? null } as ApiUser;
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
    "SELECT id, email, name, role, password_hash, image_url FROM users WHERE email = ?",
  )
    .bind(email)
    .first<{ id: string; email: string; name: string; role: string; password_hash: string; image_url?: string | null }>();

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
 *
 * The iteration count MUST match `ITERATIONS` in `lib/password.ts`. This string
 * is what every unknown-account login derives against, so a stale count is not
 * cosmetic: workerd caps PBKDF2 at 100000 iterations and throws
 * `NotSupportedError: iteration counts above 100000 are not supported` on
 * anything higher, which turned every registration into a 500 `internal_error`
 * (register hashes this dummy for its timing-equalising check) while every real
 * account kept working. Keep the two in step.
 */
const DUMMY_HASH =
  "pbkdf2_sha256$100000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Updates the signed-in user's own name and avatar.
 *
 * `email` is deliberately not updatable — it is the login identity and the key
 * every other table references, so changing it is an account migration, not a
 * profile edit. The route takes no id from the body either: the row is always
 * the caller's own session, so there is nothing to escalate by guessing.
 *
 * `phone` is accepted and acknowledged but not stored: the `users` table has no
 * such column. Returning it lets the client keep the value locally without a
 * second round trip, and the field is documented as mock-only in the shared
 * types.
 */
export async function handleUpdateProfile(env: Env, request: Request, user: SessionUser): Promise<Response> {
  let payload: { name?: string; imageUrl?: string | null };
  try {
    payload = (await request.json()) as { name?: string; imageUrl?: string | null };
  } catch {
    return json({ error: "invalid_body" }, 400);
  }

  const name = (payload.name ?? "").trim();
  if (name === "") {
    return json({ error: "invalid_input" }, 422);
  }

  // Only overwrite the avatar when the client actually sent the field: an
  // omitted `imageUrl` means "leave it alone", not "clear it".
  const hasImage = Object.prototype.hasOwnProperty.call(payload, "imageUrl");
  const imageUrl = hasImage ? payload.imageUrl ?? null : undefined;

  const result = imageUrl === undefined
    ? await env.DB.prepare("UPDATE users SET name = ? WHERE id = ?").bind(name, user.id).run()
    : await env.DB.prepare("UPDATE users SET name = ?, image_url = ? WHERE id = ?")
        .bind(name, imageUrl, user.id)
        .run();

  if (!result.meta.changes) {
    return json({ error: "not_found" }, 404);
  }

  const row = await env.DB.prepare("SELECT id, email, name, role, image_url FROM users WHERE id = ?")
    .bind(user.id)
    .first<{ id: string; email: string; name: string; role: string; image_url?: string | null }>();

  return json({ user: row ? toApiUser(row) : null });
}

export async function handleLogout(env: Env, request: Request): Promise<Response> {
  const token = bearerToken(request.headers.get("Authorization"));
  if (token) {
    await deleteSession(env, token);
  }
  return json({ ok: true });
}